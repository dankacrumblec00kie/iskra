import { and, asc, desc, eq, gt, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { blocks, matches, messages, profiles, users } from "@/db/schema";
import type { ChatThread, MatchPreview, MessageDto } from "@/lib/shared/types";
import { forbidden, notFound } from "../errors";
import { rateLimit } from "../rate-limit";
import { ageSql, loadPhotos, ONLINE_WINDOW } from "./cards";
import { scheduleDemoReply } from "./demo";
import { notify } from "./notifications";

const PAGE_SIZE = 50;

const toMessageDto = (m: typeof messages.$inferSelect, myId: string): MessageDto => ({
  id: m.id,
  body: m.body,
  mine: m.senderId === myId,
  createdAt: m.createdAt.toISOString(),
  readAt: m.readAt?.toISOString() ?? null,
});

/** Мэтч, в котором состоит пользователь, иначе 404 (чужие чаты не раскрываем). */
async function getOwnMatch(matchId: string, userId: string) {
  const [match] = await db
    .select()
    .from(matches)
    .where(
      and(eq(matches.id, matchId), or(eq(matches.userAId, userId), eq(matches.userBId, userId))),
    )
    .limit(1);
  if (!match) throw notFound("Чат не найден");
  return { ...match, otherId: match.userAId === userId ? match.userBId : match.userAId };
}

/** Собирает превью мэтчей: собеседник, последнее сообщение, счётчик непрочитанных. */
async function buildPreviews(
  userId: string,
  rows: (typeof matches.$inferSelect)[],
): Promise<MatchPreview[]> {
  if (rows.length === 0) return [];
  const otherIds = rows.map((m) => (m.userAId === userId ? m.userBId : m.userAId));
  const matchIds = rows.map((m) => m.id);

  const [people, photosByUser, lastMessages, unreadRows] = await Promise.all([
    db
      .select({
        id: profiles.userId,
        name: profiles.name,
        age: ageSql,
        online: sql<boolean>`${users.lastSeenAt} > now() - ${ONLINE_WINDOW}`,
      })
      .from(profiles)
      .innerJoin(users, eq(users.id, profiles.userId))
      .where(sql`${profiles.userId} in ${otherIds}`),
    loadPhotos(otherIds),
    // DISTINCT ON — последнее сообщение каждого чата одним запросом
    db
      .selectDistinctOn([messages.matchId])
      .from(messages)
      .where(sql`${messages.matchId} in ${matchIds}`)
      .orderBy(messages.matchId, desc(messages.createdAt)),
    db
      .select({ matchId: messages.matchId, count: sql<number>`count(*)::int` })
      .from(messages)
      .where(
        and(
          sql`${messages.matchId} in ${matchIds}`,
          ne(messages.senderId, userId),
          isNull(messages.readAt),
        ),
      )
      .groupBy(messages.matchId),
  ]);

  const personById = new Map(people.map((p) => [p.id, p]));
  const lastByMatch = new Map(lastMessages.map((m) => [m.matchId, m]));
  const unreadByMatch = new Map(unreadRows.map((r) => [r.matchId, r.count]));

  return rows.flatMap((m, i) => {
    const person = personById.get(otherIds[i]);
    if (!person) return [];
    const last = lastByMatch.get(m.id);
    return [
      {
        id: m.id,
        createdAt: m.createdAt.toISOString(),
        user: {
          id: person.id,
          name: person.name,
          age: person.age,
          online: person.online,
          photo: photosByUser.get(person.id)?.[0] ?? null,
        },
        lastMessage: last
          ? { body: last.body, createdAt: last.createdAt.toISOString(), mine: last.senderId === userId }
          : null,
        unread: unreadByMatch.get(m.id) ?? 0,
      },
    ];
  });
}

export async function listMatches(userId: string): Promise<MatchPreview[]> {
  const rows = await db
    .select()
    .from(matches)
    .where(or(eq(matches.userAId, userId), eq(matches.userBId, userId)))
    .orderBy(desc(sql`coalesce(${matches.lastMessageAt}, ${matches.createdAt})`))
    .limit(200);
  return buildPreviews(userId, rows);
}

/**
 * Сообщения чата. Без параметров — последняя страница; `after` — только новые
 * (для опроса раз в пару секунд); `before` — подгрузка истории вверх.
 * Чтение чата помечает входящие сообщения прочитанными.
 */
export async function getThread(
  matchId: string,
  userId: string,
  range: { after?: Date; before?: Date } = {},
): Promise<ChatThread> {
  const match = await getOwnMatch(matchId, userId);

  const where = and(
    eq(messages.matchId, matchId),
    range.after ? gt(messages.createdAt, range.after) : undefined,
    range.before ? lt(messages.createdAt, range.before) : undefined,
  );

  const rows = range.after
    ? await db.select().from(messages).where(where).orderBy(asc(messages.createdAt)).limit(200)
    : (
        await db.select().from(messages).where(where).orderBy(desc(messages.createdAt)).limit(PAGE_SIZE)
      ).reverse();

  await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(
      and(eq(messages.matchId, matchId), ne(messages.senderId, userId), isNull(messages.readAt)),
    );

  const [preview] = await buildPreviews(userId, [match]);
  if (!preview) throw notFound("Чат не найден");

  return { match: { ...preview, unread: 0 }, messages: rows.map((m) => toMessageDto(m, userId)) };
}

export async function sendMessage(matchId: string, userId: string, body: string): Promise<MessageDto> {
  const match = await getOwnMatch(matchId, userId);

  const [blocked] = await db
    .select({ blockerId: blocks.blockerId })
    .from(blocks)
    .where(
      or(
        and(eq(blocks.blockerId, userId), eq(blocks.blockedId, match.otherId)),
        and(eq(blocks.blockerId, match.otherId), eq(blocks.blockedId, userId)),
      ),
    )
    .limit(1);
  if (blocked) throw forbidden("Переписка с этим пользователем недоступна", "BLOCKED");

  await rateLimit(`msg:${userId}`, 40, 60, "Вы пишете слишком быстро. Подождите минуту");

  const [message] = await db
    .insert(messages)
    .values({ matchId, senderId: userId, body })
    .returning();
  await db.update(matches).set({ lastMessageAt: message.createdAt }).where(eq(matches.id, matchId));

  const [[sender], [recipient]] = await Promise.all([
    db.select({ name: profiles.name }).from(profiles).where(eq(profiles.userId, userId)).limit(1),
    db.select({ isDemo: users.isDemo }).from(users).where(eq(users.id, match.otherId)).limit(1),
  ]);
  if (recipient?.isDemo) scheduleDemoReply(matchId, match.otherId);

  await notify({
    userId: match.otherId,
    type: "message",
    persist: false,
    push: {
      title: sender?.name ?? "Новое сообщение",
      body: body.length > 120 ? `${body.slice(0, 117)}…` : body,
      url: `/chat/${matchId}`,
    },
  });

  return toMessageDto(message, userId);
}

/** «Удалить пару»: чат и история исчезают у обоих. */
export async function unmatch(matchId: string, userId: string) {
  await getOwnMatch(matchId, userId);
  await db.delete(matches).where(eq(matches.id, matchId));
}

export async function countUnreadMessages(userId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .innerJoin(matches, eq(matches.id, messages.matchId))
    .where(
      and(
        or(eq(matches.userAId, userId), eq(matches.userBId, userId)),
        ne(messages.senderId, userId),
        isNull(messages.readAt),
      ),
    );
  return row?.count ?? 0;
}

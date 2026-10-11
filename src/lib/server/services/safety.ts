import { and, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { blocks, matches, profiles, reports, users } from "@/db/schema";
import { orderedPair } from "@/lib/shared/pairs";
import type { ProfileCard } from "@/lib/shared/types";
import { badRequest, notFound } from "../errors";
import { rateLimit } from "../rate-limit";
import { getViewer, loadCards, loadPhotos, notBlockedSql } from "./cards";

/** Блокировка: пользователи перестают видеть друг друга, общий чат удаляется. */
export async function blockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) throw badRequest("Нельзя заблокировать себя");

  const [a, b] = orderedPair(blockerId, blockedId);
  await db.transaction(async (tx) => {
    await tx.insert(blocks).values({ blockerId, blockedId }).onConflictDoNothing();
    await tx.delete(matches).where(and(eq(matches.userAId, a), eq(matches.userBId, b)));
  });
}

export async function unblockUser(blockerId: string, blockedId: string) {
  await db
    .delete(blocks)
    .where(and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId)));
}

export async function listBlocked(userId: string) {
  const rows = await db
    .select({ id: profiles.userId, name: profiles.name })
    .from(blocks)
    .innerJoin(profiles, eq(profiles.userId, blocks.blockedId))
    .where(eq(blocks.blockerId, userId))
    .orderBy(desc(blocks.createdAt));
  const photosByUser = await loadPhotos(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, photo: photosByUser.get(r.id)?.[0] ?? null }));
}

export async function reportUser(input: {
  reporterId: string;
  reportedId: string;
  reason: string;
  details: string;
  block: boolean;
}) {
  if (input.reporterId === input.reportedId) throw badRequest("Нельзя пожаловаться на себя");
  await rateLimit(`report:${input.reporterId}`, 10, 3600, "Слишком много жалоб за час");

  const [exists] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, input.reportedId))
    .limit(1);
  if (!exists) throw notFound("Пользователь не найден");

  await db.insert(reports).values({
    reporterId: input.reporterId,
    reportedId: input.reportedId,
    reason: input.reason,
    details: input.details,
  });
  if (input.block) await blockUser(input.reporterId, input.reportedId);
}

/**
 * Чужая анкета по id. Доступна, только если между пользователями нет блокировки
 * и анкета либо открыта для показа, либо это уже состоявшаяся пара.
 */
export async function getPublicProfile(viewerId: string, userId: string): Promise<ProfileCard> {
  const viewer = await getViewer(viewerId);
  const [a, b] = orderedPair(viewerId, userId);

  const [row] = await db
    .select({ id: profiles.userId })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .where(
      and(
        eq(profiles.userId, userId),
        sql`${profiles.onboardedAt} is not null and ${users.bannedAt} is null`,
        notBlockedSql(viewerId),
        or(
          eq(profiles.isVisible, true),
          sql`exists (select 1 from ${matches} m where m.user_a_id = ${a} and m.user_b_id = ${b})`,
        ),
      ),
    )
    .limit(1);
  if (!row) throw notFound("Анкета недоступна");

  const [card] = await loadCards(viewer, [row.id]);
  if (!card) throw notFound("Анкета недоступна");
  return card;
}

import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import { matches, messages, profiles, swipes, users } from "@/db/schema";
import { distanceSql, genderMatchSql, getViewer, isListedSql } from "./cards";

/**
 * Демо-режим (DEMO_MODE=true). Нужен, чтобы проект можно было показать в одиночку:
 * анкеты из сида (users.is_demo) ставят лайки новичку, отвечают взаимностью и пишут
 * пару заготовленных реплик. На настоящих пользователей режим не влияет, а в интерфейсе
 * такие анкеты помечены как демонстрационные. В боевом окружении переменную не задают.
 */
export const demoMode = process.env.DEMO_MODE === "true";

const REPLIES = [
  "Привет! Приятно познакомиться 🙂 Как проходит твой день?",
  "Ха, хороший заход! Расскажи лучше, чем увлекаешься?",
  "Звучит здорово. Может, как-нибудь продолжим за кофе?",
];

/** После заполнения анкеты несколько подходящих демо-анкет «лайкают» новичка. */
export async function seedIncomingLikes(userId: string) {
  if (!demoMode) return;
  const viewer = await getViewer(userId);

  const candidates = await db
    .select({ id: profiles.userId })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .where(and(eq(users.isDemo, true), isListedSql, genderMatchSql(viewer)))
    .orderBy(sql`${distanceSql(viewer.lat, viewer.lng)} asc nulls last`)
    .limit(5);
  if (candidates.length === 0) return;

  await db
    .insert(swipes)
    .values(
      candidates.map((c, i) => ({
        fromUserId: c.id,
        toUserId: userId,
        action: i === 0 ? ("superlike" as const) : ("like" as const),
      })),
    )
    .onConflictDoNothing();
}

/** Ответит ли демо-анкета взаимностью. Детерминировано по паре: примерно 2 из 3. */
export function demoLikesBack(userId: string, demoUserId: string) {
  if (!demoMode) return false;
  const byte = createHash("sha256").update(`${userId}:${demoUserId}`).digest()[0];
  return byte % 3 !== 0;
}

/** Демо-анкета отвечает на сообщение заготовленной репликой (не больше трёх за чат). */
export function scheduleDemoReply(matchId: string, demoUserId: string) {
  if (!demoMode) return;
  after(async () => {
    try {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(messages)
        .where(and(eq(messages.matchId, matchId), eq(messages.senderId, demoUserId)));
      const reply = REPLIES[count];
      if (!reply) return;

      await new Promise((resolve) => setTimeout(resolve, 2500));
      const [message] = await db
        .insert(messages)
        .values({ matchId, senderId: demoUserId, body: reply })
        .returning({ createdAt: messages.createdAt });
      await db.update(matches).set({ lastMessageAt: message.createdAt }).where(eq(matches.id, matchId));
    } catch (error) {
      console.error("[demo] автоответ не отправлен:", error);
    }
  });
}

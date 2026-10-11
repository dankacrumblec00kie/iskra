import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { photos, profiles, swipes, users } from "@/db/schema";
import type { LikesResponse } from "@/lib/shared/types";
import type { SessionUser } from "../auth/session";
import { getViewer, isListedSql, loadCards, notBlockedSql } from "./cards";

/**
 * «Кому я нравлюсь»: входящие лайки, на которые я ещё не ответил.
 * Без подписки сервер отдаёт только количество и размытые превью — настоящие
 * фото и id анкет в ответ не попадают, поэтому открыть их через DevTools нельзя.
 */
export async function getIncomingLikes(user: SessionUser): Promise<LikesResponse> {
  const viewer = await getViewer(user.id);

  const rows = await db
    .select({ id: swipes.fromUserId, action: swipes.action })
    .from(swipes)
    .innerJoin(profiles, eq(profiles.userId, swipes.fromUserId))
    .innerJoin(users, eq(users.id, swipes.fromUserId))
    .where(
      and(
        eq(swipes.toUserId, user.id),
        ne(swipes.action, "pass"),
        isListedSql,
        notBlockedSql(user.id),
        sql`not exists (
          select 1 from ${swipes} mine
          where mine.from_user_id = ${user.id} and mine.to_user_id = ${swipes.fromUserId}
        )`,
      ),
    )
    // Суперлайки — первыми
    .orderBy(desc(sql`${swipes.action} = 'superlike'`), desc(swipes.createdAt))
    .limit(100);

  const ids = rows.map((r) => r.id);

  if (user.isPremium) {
    return { count: ids.length, unlocked: true, cards: await loadCards(viewer, ids), teasers: [] };
  }

  const blurById = new Map<string, string>();
  if (ids.length) {
    const blurRows = await db
      .selectDistinctOn([photos.userId], { userId: photos.userId, blur: photos.blurDataUrl })
      .from(photos)
      .where(sql`${photos.userId} in ${ids}`)
      .orderBy(photos.userId, photos.position);
    for (const r of blurRows) blurById.set(r.userId, r.blur);
  }

  return {
    count: ids.length,
    unlocked: false,
    cards: [],
    teasers: rows.map((r) => ({ blur: blurById.get(r.id) ?? "", superlike: r.action === "superlike" })),
  };
}

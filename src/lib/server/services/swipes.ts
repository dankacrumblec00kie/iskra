import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { matches, profiles, swipes, users } from "@/db/schema";
import { LIMITS } from "@/lib/shared/constants";
import { orderedPair } from "@/lib/shared/pairs";
import type { ProfileCard, SwipeAction, SwipeLimits, SwipeResult } from "@/lib/shared/types";
import type { SessionUser } from "../auth/session";
import { badRequest, conflict, notFound, paymentRequired } from "../errors";
import { genderMatchSql, getViewer, isListedSql, loadCards, loadPhotos, notBlockedSql } from "./cards";
import { demoLikesBack } from "./demo";
import { notify } from "./notifications";

/** Сколько лайков и суперлайков осталось за последние 24 часа. */
export async function getSwipeLimits(user: Pick<SessionUser, "id" | "isPremium">): Promise<SwipeLimits> {
  const rows = await db
    .select({ action: swipes.action, count: sql<number>`count(*)::int` })
    .from(swipes)
    .where(
      and(
        eq(swipes.fromUserId, user.id),
        inArray(swipes.action, ["like", "superlike"]),
        gt(swipes.createdAt, sql`now() - interval '24 hours'`),
      ),
    )
    .groupBy(swipes.action);

  const used = { like: 0, superlike: 0 };
  for (const r of rows) used[r.action as "like" | "superlike"] = r.count;

  const superlikesPerDay = user.isPremium
    ? LIMITS.premiumSuperlikesPerDay
    : LIMITS.freeSuperlikesPerDay;

  return {
    likesLeft: user.isPremium ? null : Math.max(0, LIMITS.freeLikesPerDay - used.like - used.superlike),
    superlikesLeft: Math.max(0, superlikesPerDay - used.superlike),
  };
}

export async function swipe(
  user: SessionUser,
  toUserId: string,
  action: SwipeAction,
): Promise<SwipeResult> {
  if (toUserId === user.id) throw badRequest("Нельзя оценить собственную анкету");

  // Те же условия, что и в ленте: анкета открыта, блокировок нет и настройки «кого показывать»
  // совпадают с обеих сторон. Иначе запросом в обход интерфейса можно было бы лайкнуть
  // человека, который не хочет видеть анкеты такого пола, и попасть к нему в «Лайки».
  const viewer = await getViewer(user.id);
  const [target] = await db
    .select({ id: profiles.userId, name: profiles.name, isDemo: users.isDemo })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .where(
      and(eq(profiles.userId, toUserId), isListedSql, notBlockedSql(user.id), genderMatchSql(viewer)),
    )
    .limit(1);
  if (!target) throw notFound("Анкета недоступна");

  if (action !== "pass") {
    const limits = await getSwipeLimits(user);
    if (limits.likesLeft !== null && limits.likesLeft <= 0) {
      throw paymentRequired("Лайки на сегодня закончились. С подпиской они безлимитные", "LIKES_LIMIT");
    }
    if (action === "superlike" && limits.superlikesLeft <= 0) {
      throw paymentRequired("Суперлайки на сегодня закончились", "SUPERLIKES_LIMIT");
    }
  }

  // Повторный свайп той же анкеты ничего не меняет — запрос идемпотентен
  const [created] = await db
    .insert(swipes)
    .values({ fromUserId: user.id, toUserId, action })
    .onConflictDoNothing({ target: [swipes.fromUserId, swipes.toUserId] })
    .returning({ id: swipes.id });

  let match: SwipeResult["match"] = null;

  if (created && action !== "pass") {
    const [theirLike] = await db
      .select({ id: swipes.id })
      .from(swipes)
      .where(
        and(
          eq(swipes.fromUserId, toUserId),
          eq(swipes.toUserId, user.id),
          inArray(swipes.action, ["like", "superlike"]),
        ),
      )
      .limit(1);

    if (theirLike) {
      match = await createMatch(user.id, target);
    } else if (target.isDemo && demoLikesBack(user.id, target.id)) {
      // Демо-режим: анкета из сида отвечает взаимностью
      await db
        .insert(swipes)
        .values({ fromUserId: target.id, toUserId: user.id, action: "like" })
        .onConflictDoNothing();
      match = await createMatch(user.id, target);
    } else {
      await notify({
        userId: toUserId,
        type: action,
        push: {
          title: action === "superlike" ? "Вам поставили суперлайк ⭐" : "Вы кому-то понравились 💛",
          body: "Откройте «Лайки», чтобы посмотреть",
          url: "/likes",
        },
      });
    }
  }

  return { match, limits: await getSwipeLimits(user) };
}

async function createMatch(
  myId: string,
  target: { id: string; name: string },
): Promise<SwipeResult["match"]> {
  const [userAId, userBId] = orderedPair(myId, target.id);

  // Уникальный индекс по паре защищает от дубля, если оба лайкнули одновременно
  const [created] = await db
    .insert(matches)
    .values({ userAId, userBId })
    .onConflictDoNothing({ target: [matches.userAId, matches.userBId] })
    .returning({ id: matches.id });

  const [existing] = created
    ? [created]
    : await db
        .select({ id: matches.id })
        .from(matches)
        .where(and(eq(matches.userAId, userAId), eq(matches.userBId, userBId)))
        .limit(1);

  const [me] = await db
    .select({ name: profiles.name })
    .from(profiles)
    .where(eq(profiles.userId, myId))
    .limit(1);
  const photosByUser = await loadPhotos([myId, target.id]);

  if (created) {
    await Promise.all([
      notify({
        userId: target.id,
        type: "match",
        payload: { matchId: created.id, userId: myId, name: me?.name },
        push: {
          title: "Это взаимно! 🎉",
          body: `${me?.name ?? "Кто-то"} тоже лайкнул(а) вас — напишите первым`,
          url: `/chat/${created.id}`,
        },
      }),
      notify({
        userId: myId,
        type: "match",
        payload: { matchId: created.id, userId: target.id, name: target.name },
      }),
    ]);
  }

  return {
    id: existing.id,
    user: { id: target.id, name: target.name, photo: photosByUser.get(target.id)?.[0] ?? null },
  };
}

/**
 * Отмена последнего свайпа (функция подписки). Мэтч отменить нельзя —
 * для этого есть «Удалить пару».
 */
export async function rewindLastSwipe(user: SessionUser): Promise<ProfileCard | null> {
  if (!user.isPremium) {
    throw paymentRequired("Вернуть анкету можно с подпиской", "PREMIUM_REQUIRED");
  }

  const [last] = await db
    .select()
    .from(swipes)
    .where(eq(swipes.fromUserId, user.id))
    .orderBy(desc(swipes.createdAt))
    .limit(1);
  if (!last) throw notFound("Отменять пока нечего");

  const [a, b] = orderedPair(user.id, last.toUserId);
  const [matched] = await db
    .select({ id: matches.id })
    .from(matches)
    .where(and(eq(matches.userAId, a), eq(matches.userBId, b)))
    .limit(1);
  if (matched) throw conflict("Это уже взаимная симпатия — её нельзя отменить", "ALREADY_MATCHED");

  await db.delete(swipes).where(eq(swipes.id, last.id));

  const viewer = await getViewer(user.id);
  const [card] = await loadCards(viewer, [last.toUserId]);
  return card ?? null;
}

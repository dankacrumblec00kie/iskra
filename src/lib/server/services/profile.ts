import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { notifications, photos, profileInterests, profiles, swipes, users } from "@/db/schema";
import { ageFromBirthDate } from "@/lib/shared/geo";
import type { Counters, Me } from "@/lib/shared/types";
import type { OnboardingInput, ProfilePatchInput } from "@/lib/shared/validation";
import type { SessionUser } from "../auth/session";
import { badRequest, forbidden } from "../errors";
import { genderMatchSql, isListedSql, loadPhotos, notBlockedSql } from "./cards";
import { countUnreadMessages } from "./matches";
import { getSwipeLimits } from "./swipes";

/**
 * Координаты храним с точностью до ~1 км (2 знака после запятой):
 * для подбора «рядом» этого достаточно, а точный адрес в базе не оседает.
 */
const coarse = (value: number) => Math.round(value * 100) / 100;

async function replaceInterests(tx: Tx, userId: string, slugs: string[]) {
  await tx.delete(profileInterests).where(eq(profileInterests.userId, userId));
  if (slugs.length) {
    await tx.insert(profileInterests).values(slugs.map((interestSlug) => ({ userId, interestSlug })));
  }
}

export async function getMe(user: SessionUser): Promise<Me> {
  const [[profile], photosByUser, interestRows, limits] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1),
    loadPhotos([user.id]),
    db
      .select({ slug: profileInterests.interestSlug })
      .from(profileInterests)
      .where(eq(profileInterests.userId, user.id)),
    getSwipeLimits(user),
  ]);

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isPremium: user.isPremium,
    premiumUntil: user.premiumUntil?.toISOString() ?? null,
    onboarded: Boolean(profile?.onboardedAt),
    profile: profile
      ? {
          name: profile.name,
          birthDate: profile.birthDate,
          age: ageFromBirthDate(profile.birthDate),
          gender: profile.gender,
          lookingFor: profile.lookingFor,
          goal: profile.goal,
          bio: profile.bio,
          job: profile.job,
          heightCm: profile.heightCm,
          city: profile.city,
          lat: profile.lat,
          lng: profile.lng,
          ageMin: profile.ageMin,
          ageMax: profile.ageMax,
          maxDistanceKm: profile.maxDistanceKm,
          isVisible: profile.isVisible,
          boostedUntil: profile.boostedUntil?.toISOString() ?? null,
        }
      : null,
    photos: photosByUser.get(user.id) ?? [],
    interests: interestRows.map((r) => r.slug),
    limits,
  };
}

/** Сохраняет анкету при первом входе. Требует хотя бы одну загруженную фотографию. */
export async function completeOnboarding(userId: string, input: OnboardingInput) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(photos)
    .where(eq(photos.userId, userId));
  if (count === 0) throw badRequest("Добавьте хотя бы одну фотографию", "PHOTO_REQUIRED");

  const { interests, lat, lng, ...fields } = input;
  const age = ageFromBirthDate(input.birthDate);
  const values = {
    ...fields,
    lat: coarse(lat),
    lng: coarse(lng),
    // Разумный диапазон возраста по умолчанию: ±7 лет от своего
    ageMin: Math.max(18, age - 7),
    ageMax: Math.min(99, age + 7),
    onboardedAt: new Date(),
    updatedAt: new Date(),
  };

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ onboardedAt: profiles.onboardedAt })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    if (existing?.onboardedAt) throw forbidden("Анкета уже заполнена", "ALREADY_ONBOARDED");

    await tx
      .insert(profiles)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: profiles.userId, set: values });
    await replaceInterests(tx, userId, interests);
  });
}

export async function updateProfile(userId: string, patch: ProfilePatchInput) {
  const { interests, lat, lng, ...fields } = patch;

  await db.transaction(async (tx) => {
    const set = {
      ...fields,
      ...(lat !== undefined && lng !== undefined ? { lat: coarse(lat), lng: coarse(lng) } : {}),
      updatedAt: new Date(),
    };
    const updated = await tx
      .update(profiles)
      .set(set)
      .where(eq(profiles.userId, userId))
      .returning({ userId: profiles.userId });
    if (updated.length === 0) throw forbidden("Сначала заполните анкету", "NOT_ONBOARDED");

    if (interests) await replaceInterests(tx, userId, interests);
  });
}

/** Удаление аккаунта. Каскады в схеме убирают профиль, фото, свайпы, мэтчи и сообщения. */
export async function deleteAccount(userId: string) {
  const rows = await db
    .select({ storageKey: photos.storageKey })
    .from(photos)
    .where(eq(photos.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
  return rows.map((r) => r.storageKey);
}

/** Счётчики для бейджей в навигации. */
export async function getCounters(userId: string): Promise<Counters> {
  const [me] = await db
    .select({ gender: profiles.gender, lookingFor: profiles.lookingFor })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!me) return { unreadMessages: 0, newLikes: 0, unreadNotifications: 0 };

  const [unreadMessages, [likes], [notes]] = await Promise.all([
    countUnreadMessages(userId),
    // Лайки, на которые я ещё не ответил. Условия те же, что в списке «Лайки»,
    // иначе число на бейдже расходилось бы с тем, что видно на экране.
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(swipes)
      .innerJoin(profiles, eq(profiles.userId, swipes.fromUserId))
      .innerJoin(users, eq(users.id, swipes.fromUserId))
      .where(
        and(
          eq(swipes.toUserId, userId),
          ne(swipes.action, "pass"),
          isListedSql,
          genderMatchSql(me),
          notBlockedSql(userId),
          sql`not exists (
            select 1 from ${swipes} mine
            where mine.from_user_id = ${userId} and mine.to_user_id = ${swipes.fromUserId}
          )`,
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
  ]);

  return {
    unreadMessages,
    newLikes: likes?.count ?? 0,
    unreadNotifications: notes?.count ?? 0,
  };
}

import { and, asc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { blocks, matches, photos, profileInterests, profiles, swipes, users } from "@/db/schema";
import type { Gender, LookingFor } from "@/lib/shared/constants";
import { publicDistanceKm } from "@/lib/shared/geo";
import type { PhotoDto, ProfileCard } from "@/lib/shared/types";
import { forbidden } from "../errors";

/** Минимум сведений о смотрящем, нужный для подбора и расчёта расстояний. */
export type Viewer = {
  userId: string;
  gender: Gender;
  lookingFor: LookingFor;
  lat: number | null;
  lng: number | null;
  ageMin: number;
  ageMax: number;
  maxDistanceKm: number;
  interests: string[];
};

export const ONLINE_WINDOW = sql`interval '5 minutes'`;

export const ageSql = sql<number>`date_part('year', age(${profiles.birthDate}))::int`;

/** SQL-выражение расстояния (км) от точки до анкеты по формуле гаверсинусов. */
export function distanceSql(lat: number | null, lng: number | null): SQL<number | null> {
  if (lat === null || lng === null) return sql<null>`null::float8`;
  return sql<number>`(6371 * acos(least(1, greatest(-1,
    cos(radians(${lat}::float8)) * cos(radians(${profiles.lat})) *
    cos(radians(${profiles.lng}) - radians(${lng}::float8)) +
    sin(radians(${lat}::float8)) * sin(radians(${profiles.lat}))
  ))))`;
}

/** Условие «между смотрящим и анкетой нет блокировки ни в одну сторону». */
export function notBlockedSql(viewerId: string) {
  return sql`not exists (
    select 1 from ${blocks} b
    where (b.blocker_id = ${viewerId} and b.blocked_id = ${profiles.userId})
       or (b.blocker_id = ${profiles.userId} and b.blocked_id = ${viewerId})
  )`;
}

/** Анкета доступна для показа: заполнена, не скрыта, владелец не заблокирован. */
export const isListedSql = sql`(${profiles.onboardedAt} is not null and ${profiles.isVisible} and ${users.bannedAt} is null)`;

/**
 * Взаимная совместимость по полу: анкета подходит под мой выбор «кого показывать»,
 * и я подхожу под её выбор. Это единственное правило подбора по полу —
 * оно одинаково работает для любых сочетаний.
 */
export function genderMatchSql(viewer: Pick<Viewer, "gender" | "lookingFor">) {
  const iWantThem =
    viewer.lookingFor === "everyone" ? sql`true` : eq(profiles.gender, viewer.lookingFor);
  const theyWantMe =
    viewer.gender === "other"
      ? eq(profiles.lookingFor, "everyone")
      : or(eq(profiles.lookingFor, "everyone"), eq(profiles.lookingFor, viewer.gender))!;
  return and(iWantThem, theyWantMe)!;
}

export async function getViewer(userId: string): Promise<Viewer> {
  const [row] = await db
    .select({
      userId: profiles.userId,
      gender: profiles.gender,
      lookingFor: profiles.lookingFor,
      lat: profiles.lat,
      lng: profiles.lng,
      ageMin: profiles.ageMin,
      ageMax: profiles.ageMax,
      maxDistanceKm: profiles.maxDistanceKm,
      onboardedAt: profiles.onboardedAt,
    })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  if (!row?.onboardedAt) throw forbidden("Сначала заполните анкету", "NOT_ONBOARDED");

  const mine = await db
    .select({ slug: profileInterests.interestSlug })
    .from(profileInterests)
    .where(eq(profileInterests.userId, userId));

  return { ...row, interests: mine.map((i) => i.slug) };
}

export function toPhotoDto(p: {
  id: string;
  url: string;
  width: number;
  height: number;
  blurDataUrl: string;
}): PhotoDto {
  return { id: p.id, url: p.url, width: p.width, height: p.height, blur: p.blurDataUrl };
}

/** Фотографии для набора пользователей, сгруппированные по владельцу. */
export async function loadPhotos(userIds: string[]) {
  const byUser = new Map<string, PhotoDto[]>();
  if (userIds.length === 0) return byUser;
  const rows = await db
    .select()
    .from(photos)
    .where(inArray(photos.userId, userIds))
    .orderBy(asc(photos.position), asc(photos.createdAt));
  for (const row of rows) {
    const list = byUser.get(row.userId) ?? [];
    list.push(toPhotoDto(row));
    byUser.set(row.userId, list);
  }
  return byUser;
}

/**
 * Собирает карточки анкет для списка id, сохраняя их порядок.
 * Проверки видимости выполняет вызывающий код — здесь только сборка данных.
 */
export async function loadCards(viewer: Viewer, ids: string[]): Promise<ProfileCard[]> {
  if (ids.length === 0) return [];

  const [rows, photosByUser, interestRows, mySwipes, theirSuperlikes, myMatches] = await Promise.all([
    db
      .select({
        id: profiles.userId,
        name: profiles.name,
        age: ageSql,
        gender: profiles.gender,
        city: profiles.city,
        distance: distanceSql(viewer.lat, viewer.lng),
        bio: profiles.bio,
        job: profiles.job,
        goal: profiles.goal,
        heightCm: profiles.heightCm,
        online: sql<boolean>`${users.lastSeenAt} > now() - ${ONLINE_WINDOW}`,
        isPremium: sql<boolean>`coalesce(${users.premiumUntil} > now(), false)`,
      })
      .from(profiles)
      .innerJoin(users, eq(users.id, profiles.userId))
      .where(inArray(profiles.userId, ids)),
    loadPhotos(ids),
    db
      .select({ userId: profileInterests.userId, slug: profileInterests.interestSlug })
      .from(profileInterests)
      .where(inArray(profileInterests.userId, ids)),
    db
      .select({ toUserId: swipes.toUserId, action: swipes.action })
      .from(swipes)
      .where(and(eq(swipes.fromUserId, viewer.userId), inArray(swipes.toUserId, ids))),
    db
      .select({ fromUserId: swipes.fromUserId })
      .from(swipes)
      .where(
        and(
          eq(swipes.toUserId, viewer.userId),
          eq(swipes.action, "superlike"),
          inArray(swipes.fromUserId, ids),
        ),
      ),
    db
      .select({ id: matches.id, a: matches.userAId, b: matches.userBId })
      .from(matches)
      .where(
        or(
          and(eq(matches.userAId, viewer.userId), inArray(matches.userBId, ids)),
          and(eq(matches.userBId, viewer.userId), inArray(matches.userAId, ids)),
        ),
      ),
  ]);

  const interestsByUser = new Map<string, string[]>();
  for (const r of interestRows) {
    const list = interestsByUser.get(r.userId) ?? [];
    list.push(r.slug);
    interestsByUser.set(r.userId, list);
  }
  const actionByUser = new Map(mySwipes.map((s) => [s.toUserId, s.action]));
  const superliked = new Set(theirSuperlikes.map((s) => s.fromUserId));
  const matchByUser = new Map(myMatches.map((m) => [m.a === viewer.userId ? m.b : m.a, m.id]));
  const mine = new Set(viewer.interests);
  const byId = new Map(rows.map((r) => [r.id, r]));

  const cards: ProfileCard[] = [];
  for (const id of ids) {
    const r = byId.get(id);
    if (!r) continue;
    const interests = interestsByUser.get(id) ?? [];
    cards.push({
      id: r.id,
      name: r.name,
      age: r.age,
      gender: r.gender,
      city: r.city,
      distanceKm: publicDistanceKm(r.distance),
      bio: r.bio,
      job: r.job,
      goal: r.goal,
      heightCm: r.heightCm,
      photos: photosByUser.get(id) ?? [],
      interests,
      sharedInterests: interests.filter((slug) => mine.has(slug)),
      online: r.online,
      isPremium: r.isPremium,
      superLikedYou: superliked.has(id),
      myAction: actionByUser.get(id) ?? null,
      matchId: matchByUser.get(id) ?? null,
    });
  }
  return cards;
}

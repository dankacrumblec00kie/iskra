import { and, desc, eq, gt, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { interests, profileInterests, profiles, swipes, users } from "@/db/schema";
import { LIMITS } from "@/lib/shared/constants";
import type { ProfileCard } from "@/lib/shared/types";
import type { SearchFilters } from "@/lib/shared/validation";
import {
  ageSql,
  distanceSql,
  genderMatchSql,
  isListedSql,
  loadCards,
  notBlockedSql,
  ONLINE_WINDOW,
  type Viewer,
} from "./cards";

const DECK_SIZE = 20;
const GRID_PAGE = 24;

/** Экранирует спецсимволы LIKE, чтобы «%» в запросе искался буквально. */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (ch) => `\\${ch}`);

/** Условия, общие для ленты свайпов и сетки «Рядом». */
function buildConditions(viewer: Viewer, filters: SearchFilters): SQL[] {
  const ageMin = filters.ageMin ?? viewer.ageMin;
  const ageMax = Math.max(ageMin, filters.ageMax ?? viewer.ageMax);
  const maxDistance = filters.distance ?? viewer.maxDistanceKm;

  const conditions: SQL[] = [
    ne(profiles.userId, viewer.userId),
    isListedSql,
    genderMatchSql(viewer),
    notBlockedSql(viewer.userId),
    sql`${ageSql} between ${ageMin} and ${ageMax}`,
  ];

  // Максимум на ползунке означает «неважно, где»
  if (maxDistance < LIMITS.maxDistanceKm && viewer.lat !== null && viewer.lng !== null) {
    conditions.push(sql`${distanceSql(viewer.lat, viewer.lng)} <= ${maxDistance}`);
  }
  if (filters.goal) conditions.push(eq(profiles.goal, filters.goal));
  if (filters.online) conditions.push(gt(users.lastSeenAt, sql`now() - ${ONLINE_WINDOW}`));

  if (filters.interests?.length) {
    conditions.push(sql`exists (
      select 1 from ${profileInterests} pi
      where pi.user_id = ${profiles.userId} and pi.interest_slug in ${filters.interests}
    )`);
  }

  if (filters.q) {
    const pattern = `%${escapeLike(filters.q)}%`;
    conditions.push(sql`(
      ${profiles.name} ilike ${pattern} or ${profiles.bio} ilike ${pattern}
      or ${profiles.job} ilike ${pattern} or ${profiles.city} ilike ${pattern}
      or exists (
        select 1 from ${profileInterests} pi
        join ${interests} i on i.slug = pi.interest_slug
        where pi.user_id = ${profiles.userId} and i.label ilike ${pattern}
      )
    )`);
  }

  return conditions;
}

/**
 * Лента для свайпов: только те, кого я ещё не оценивал.
 * Порядок: активный буст → те, кто уже лайкнул меня → больше общих интересов → недавно в сети.
 */
export async function getDeck(viewer: Viewer, filters: SearchFilters): Promise<ProfileCard[]> {
  const notSwiped = sql`not exists (
    select 1 from ${swipes} s
    where s.from_user_id = ${viewer.userId} and s.to_user_id = ${profiles.userId}
  )`;
  const boosted = sql<number>`case when ${profiles.boostedUntil} > now() then 1 else 0 end`;
  const likedMe = sql<number>`case when exists (
    select 1 from ${swipes} s
    where s.from_user_id = ${profiles.userId} and s.to_user_id = ${viewer.userId}
      and s.action in ('like', 'superlike')
  ) then 1 else 0 end`;
  const shared = viewer.interests.length
    ? sql<number>`(
        select count(*) from ${profileInterests} pi
        where pi.user_id = ${profiles.userId} and pi.interest_slug in ${viewer.interests}
      )`
    : sql<number>`0`;

  const rows = await db
    .select({ id: profiles.userId })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .where(and(...buildConditions(viewer, filters), notSwiped))
    .orderBy(desc(boosted), desc(likedMe), desc(shared), desc(users.lastSeenAt))
    .limit(DECK_SIZE);

  return loadCards(
    viewer,
    rows.map((r) => r.id),
  );
}

/** Сетка «Рядом»: все подходящие анкеты по возрастанию расстояния, с поиском и пагинацией. */
export async function getNearby(
  viewer: Viewer,
  filters: SearchFilters,
): Promise<{ cards: ProfileCard[]; nextCursor: number | null }> {
  const offset = filters.cursor ?? 0;
  const distance = distanceSql(viewer.lat, viewer.lng);

  const rows = await db
    .select({ id: profiles.userId })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .where(and(...buildConditions(viewer, filters)))
    .orderBy(sql`${distance} asc nulls last`, desc(users.lastSeenAt), profiles.userId)
    .limit(GRID_PAGE + 1)
    .offset(offset);

  const hasMore = rows.length > GRID_PAGE;
  const cards = await loadCards(
    viewer,
    rows.slice(0, GRID_PAGE).map((r) => r.id),
  );
  return { cards, nextCursor: hasMore ? offset + GRID_PAGE : null };
}

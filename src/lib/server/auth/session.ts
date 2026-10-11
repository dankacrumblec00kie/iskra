import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { after } from "next/server";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { forbidden, unauthorized } from "../errors";

export const SESSION_COOKIE = "iskra_session";
const SESSION_TTL_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  role: "user" | "admin";
  premiumUntil: Date | null;
  isPremium: boolean;
  sessionId: string;
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Создаёт сессию и ставит httpOnly-cookie. В базе хранится только хэш токена. */
export async function createSession(userId: string, userAgent: string | null) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    userAgent: userAgent?.slice(0, 300) ?? null,
    expiresAt,
  });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  store.delete(SESSION_COOKIE);
}

/** Текущий пользователь по cookie или null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      premiumUntil: users.premiumUntil,
      bannedAt: users.bannedAt,
      sessionId: sessions.id,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!row) {
    // Сессия истекла или отозвана: убираем cookie, иначе proxy будет считать
    // пользователя вошедшим и гонять его между /login и /discover
    store.delete(SESSION_COOKIE);
    return null;
  }
  if (row.bannedAt) throw forbidden("Аккаунт заблокирован за нарушение правил", "BANNED");

  // Отметку «был в сети» обновляем после ответа и не чаще раза в минуту
  after(() =>
    db
      .update(users)
      .set({ lastSeenAt: new Date() })
      .where(and(eq(users.id, row.id), lt(users.lastSeenAt, sql`now() - interval '1 minute'`)))
      .catch(() => {}),
  );

  return {
    id: row.id,
    email: row.email,
    role: row.role,
    premiumUntil: row.premiumUntil,
    isPremium: row.premiumUntil !== null && row.premiumUntil > new Date(),
    sessionId: row.sessionId,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw forbidden();
  return user;
}

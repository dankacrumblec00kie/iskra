import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  exchangeCode,
  GOOGLE_STATE_COOKIE,
  GOOGLE_VERIFIER_COOKIE,
  googleEnabled,
} from "@/lib/server/auth/google";
import { createSession } from "@/lib/server/auth/session";
import { api } from "@/lib/server/http";
import { upsertGoogleUser } from "@/lib/server/services/auth";

// Шаг 2 OAuth2: Google вернул пользователя с кодом. Сверяем state (защита от CSRF),
// меняем код на токен и создаём сессию.
export const GET = api(async (req) => {
  const fail = () => NextResponse.redirect(new URL("/login?error=oauth", req.nextUrl.origin));
  if (!googleEnabled) return fail();

  const store = await cookies();
  const expectedState = store.get(GOOGLE_STATE_COOKIE)?.value;
  const verifier = store.get(GOOGLE_VERIFIER_COOKIE)?.value;
  store.delete({ name: GOOGLE_STATE_COOKIE, path: "/api/auth/google" });
  store.delete({ name: GOOGLE_VERIFIER_COOKIE, path: "/api/auth/google" });

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state || !expectedState || !verifier) return fail();

  const a = Buffer.from(state);
  const b = Buffer.from(expectedState);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return fail();

  try {
    const profile = await exchangeCode(code, verifier, req.nextUrl.origin);
    const user = await upsertGoogleUser(profile);
    await createSession(user.id, req.headers.get("user-agent"));
  } catch (error) {
    console.error("[oauth] вход через Google не удался:", error);
    return fail();
  }
  return NextResponse.redirect(new URL("/discover", req.nextUrl.origin));
});

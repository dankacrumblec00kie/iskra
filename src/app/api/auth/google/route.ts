import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createAuthorizationRequest,
  GOOGLE_STATE_COOKIE,
  GOOGLE_VERIFIER_COOKIE,
  googleEnabled,
} from "@/lib/server/auth/google";
import { notFound } from "@/lib/server/errors";
import { api } from "@/lib/server/http";

// Шаг 1 OAuth2: отправляем пользователя на страницу согласия Google.
export const GET = api(async (req) => {
  if (!googleEnabled) throw notFound("Вход через Google не настроен");

  const { url, state, verifier } = createAuthorizationRequest(req.nextUrl.origin);
  const store = await cookies();
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/auth/google",
    maxAge: 600,
  };
  store.set(GOOGLE_STATE_COOKIE, state, options);
  store.set(GOOGLE_VERIFIER_COOKIE, verifier, options);

  return NextResponse.redirect(url);
});

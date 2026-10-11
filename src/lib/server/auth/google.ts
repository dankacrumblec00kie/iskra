import { createHash, randomBytes } from "node:crypto";

// OAuth 2.0 Authorization Code + PKCE для Google, без сторонних библиотек.
// Включается, только если заданы GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET.

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const googleEnabled = Boolean(clientId && clientSecret);
export const GOOGLE_STATE_COOKIE = "iskra_oauth_state";
export const GOOGLE_VERIFIER_COOKIE = "iskra_oauth_verifier";

export function appUrl(fallbackOrigin?: string) {
  return (process.env.NEXT_PUBLIC_APP_URL ?? fallbackOrigin ?? "http://localhost:3000").replace(/\/$/, "");
}

const redirectUri = (origin?: string) => `${appUrl(origin)}/api/auth/google/callback`;

export function createAuthorizationRequest(origin?: string) {
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId!,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: "openid email",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();

  return { url: url.toString(), state, verifier };
}

/** Меняет code на токен и возвращает подтверждённый e-mail пользователя. */
export async function exchangeCode(code: string, verifier: string, origin?: string) {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId!,
      client_secret: clientSecret!,
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!tokenResponse.ok) throw new Error(`Google token: ${tokenResponse.status}`);
  const { access_token: accessToken } = (await tokenResponse.json()) as { access_token: string };

  const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!userResponse.ok) throw new Error(`Google userinfo: ${userResponse.status}`);
  const info = (await userResponse.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
  };

  // Неподтверждённый e-mail нельзя привязывать к существующему аккаунту
  if (!info.sub || !info.email || !info.email_verified) {
    throw new Error("Google не подтвердил e-mail");
  }
  return { sub: info.sub, email: info.email };
}

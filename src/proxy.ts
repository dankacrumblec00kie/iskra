import { NextResponse, type NextRequest } from "next/server";

// Proxy (бывший middleware) выполняет только «оптимистичную» проверку: есть ли cookie сессии.
// Это быстрый редирект для удобства, а не защита данных — настоящая проверка сессии
// происходит в каждом обработчике API (requireUser).

const SESSION_COOKIE = "iskra_session";
const GUEST_ONLY = ["/login", "/register"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const guestOnly = GUEST_ONLY.includes(pathname);

  if (!hasSession && !guestOnly) {
    const url = new URL("/login", request.url);
    if (pathname !== "/discover") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (hasSession && guestOnly) {
    return NextResponse.redirect(new URL("/discover", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/register",
    "/onboarding",
    "/discover",
    "/nearby",
    "/likes",
    "/matches",
    "/chat/:path*",
    "/profile/:path*",
    "/u/:path*",
    "/premium/:path*",
    "/settings",
    "/notifications",
    "/admin/:path*",
  ],
};

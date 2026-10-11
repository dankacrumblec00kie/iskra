"use client";

import clsx from "clsx";
import { Bell, Compass, Crown, Flame, Heart, MessageCircle, Settings, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";
import { useCounters, useMe } from "@/lib/client/hooks";
import type { Counters } from "@/lib/shared/types";
import { Logo } from "./logo";
import { Badge, ErrorState, ScreenLoader } from "./ui/misc";

const TABS = [
  { href: "/discover", label: "Лента", icon: Flame },
  { href: "/nearby", label: "Рядом", icon: Compass },
  { href: "/likes", label: "Лайки", icon: Heart, counter: "newLikes" },
  { href: "/matches", label: "Чаты", icon: MessageCircle, counter: "unreadMessages" },
  { href: "/profile", label: "Профиль", icon: User },
] as const satisfies readonly { href: string; label: string; icon: unknown; counter?: keyof Counters }[];

const isActive = (pathname: string | null, href: string) =>
  pathname === href ||
  pathname?.startsWith(`${href}/`) ||
  (href === "/matches" && pathname?.startsWith("/chat/")) ||
  false;

/**
 * Каркас авторизованной части: проверяет сессию и анкету, рисует навигацию.
 * На телефоне — нижняя панель вкладок, на десктопе — боковое меню.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: me, error, mutate } = useMe();

  useEffect(() => {
    if (error?.status === 401) router.replace("/login");
    else if (me && !me.onboarded) router.replace("/onboarding");
  }, [error, me, router]);

  const isPremium = me?.isPremium ?? false;
  // Сессии нет или анкета не заполнена: идёт редирект, содержимое прикрываем
  const leaving = error?.status === 401 || (me !== undefined && !me.onboarded);
  const failed = error !== undefined && error.status !== 401 && !me;

  // Каркас и страница рендерятся всегда, не дожидаясь /api/me: навигация появляется
  // мгновенно, а экраны сами показывают скелетоны, пока грузятся их данные.
  return (
    <div className="flex min-h-dvh">
      {/* usePathname на динамических маршрутах требует Suspense при пререндере */}
      <Suspense fallback={<Navigation pathname={null} isPremium={isPremium} />}>
        <NavigationWithPath isPremium={isPremium} />
      </Suspense>
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>

      {(leaving || failed) && (
        <div className="fixed inset-0 z-[70] flex bg-bg">
          {failed ? <ErrorState message={error.message} onRetry={() => mutate()} /> : <ScreenLoader />}
        </div>
      )}
    </div>
  );
}

function NavigationWithPath({ isPremium }: { isPremium: boolean }) {
  return <Navigation pathname={usePathname()} isPremium={isPremium} />;
}

function Navigation({ pathname, isPremium }: { pathname: string | null; isPremium: boolean }) {
  const { data: counters } = useCounters();
  // В открытом чате нижняя панель скрыта: место занимает поле ввода
  const inChat = pathname?.startsWith("/chat/") ?? false;

  return (
    <>
      {/* Десктоп: боковое меню */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface/40 p-4 lg:flex">
        <Link href="/discover" className="px-3 py-3">
          <Logo />
        </Link>
        <nav className="mt-4 flex flex-col gap-1" aria-label="Основная навигация">
          {TABS.map((tab) => (
            <SideLink
              key={tab.href}
              href={tab.href}
              active={isActive(pathname, tab.href)}
              icon={<tab.icon className="size-5" />}
              count={"counter" in tab ? (counters?.[tab.counter] ?? 0) : 0}
            >
              {tab.label}
            </SideLink>
          ))}
          <SideLink
            href="/notifications"
            active={isActive(pathname, "/notifications")}
            icon={<Bell className="size-5" />}
            count={counters?.unreadNotifications ?? 0}
          >
            Уведомления
          </SideLink>
          <SideLink href="/settings" active={isActive(pathname, "/settings")} icon={<Settings className="size-5" />}>
            Настройки
          </SideLink>
        </nav>

        <Link
          href="/premium"
          className="mt-auto rounded-3xl bg-spark p-4 text-white transition hover:brightness-110"
        >
          <Crown className="size-6" />
          <div className="mt-2 font-display text-sm font-bold">
            {isPremium ? "Искра Premium активна" : "Искра Premium"}
          </div>
          <div className="mt-1 text-xs text-white/85">
            {isPremium ? "Управление подпиской и буст" : "Узнайте, кому вы нравитесь, и лайкайте без лимита"}
          </div>
        </Link>
      </aside>

      {/* Телефон: нижняя панель вкладок */}
      <nav
        className={clsx(
          "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 pb-safe backdrop-blur-xl lg:hidden",
          inChat && "hidden",
        )}
        aria-label="Основная навигация"
      >
        <ul className="mx-auto flex h-16 max-w-md items-stretch">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab.href);
            const count = "counter" in tab ? (counters?.[tab.counter] ?? 0) : 0;
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold transition",
                    active ? "text-brand" : "text-faint hover:text-muted",
                  )}
                >
                  <span className="relative">
                    <tab.icon className="size-6" strokeWidth={active ? 2.4 : 2} />
                    <Badge count={count} className="absolute -top-1.5 -right-2.5" />
                  </span>
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

function SideLink({
  href,
  active,
  icon,
  count = 0,
  children,
}: {
  href: string;
  active: boolean;
  icon: ReactNode;
  count?: number;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex h-11 items-center gap-3 rounded-2xl px-3 text-[15px] font-semibold transition",
        active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2/60 hover:text-fg",
      )}
    >
      <span className={active ? "text-brand" : undefined}>{icon}</span>
      <span className="flex-1">{children}</span>
      <Badge count={count} />
    </Link>
  );
}

"use client";

import clsx from "clsx";
import { ArrowLeft, Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCounters } from "@/lib/client/hooks";
import { IconButton } from "./ui/button";

/** Типовой экран приложения: липкая шапка с заголовком и прокручиваемое содержимое. */
export function Screen({
  title,
  back,
  actions,
  children,
  wide,
  flush,
}: {
  title: ReactNode;
  /** Показать «назад»; строка — запасной адрес, если истории нет */
  back?: boolean | string;
  actions?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  /** Без боковых отступов у содержимого */
  flush?: boolean;
}) {
  return (
    <div className={clsx("mx-auto flex min-h-dvh w-full flex-col", wide ? "max-w-5xl" : "max-w-2xl")}>
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-1 bg-bg/85 px-3 backdrop-blur-xl lg:h-16 lg:px-6">
        {back && <BackButton fallback={typeof back === "string" ? back : "/discover"} />}
        <h1 className="flex-1 truncate px-1 font-display text-lg font-bold lg:text-xl">{title}</h1>
        {actions}
      </header>
      <div className={clsx("flex flex-1 flex-col pb-28 lg:pb-10", !flush && "px-4 lg:px-6")}>{children}</div>
    </div>
  );
}

export function BackButton({ fallback }: { fallback: string }) {
  const router = useRouter();
  return (
    <IconButton
      label="Назад"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
    >
      <ArrowLeft className="size-5" />
    </IconButton>
  );
}

/** Колокольчик с числом непрочитанных — для шапки на телефоне. */
export function NotificationsLink() {
  const { data } = useCounters();
  const count = data?.unreadNotifications ?? 0;
  return (
    <Link
      href="/notifications"
      aria-label={count ? `Уведомления, новых: ${count}` : "Уведомления"}
      className="relative inline-flex size-10 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg lg:hidden"
    >
      <Bell className="size-5" />
      {count > 0 && <span className="absolute top-2 right-2 size-2.5 rounded-full bg-brand ring-2 ring-bg" />}
    </Link>
  );
}

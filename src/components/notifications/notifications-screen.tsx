"use client";

import clsx from "clsx";
import Link from "next/link";
import { useEffect } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Screen } from "@/components/screen";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/misc";
import { api, errorMessage, fetcher } from "@/lib/client/api";
import { formatListTime } from "@/lib/client/format";
import { KEYS } from "@/lib/client/hooks";
import type { NotificationDto } from "@/lib/shared/types";

/** Как показать уведомление каждого типа и куда оно ведёт. */
function describe(n: NotificationDto): { emoji: string; text: string; href: string } {
  const name = typeof n.payload.name === "string" ? n.payload.name : "Кто-то";
  switch (n.type) {
    case "match":
      return {
        emoji: "🎉",
        text: `Взаимная симпатия: ${name}. Напишите первым!`,
        href: typeof n.payload.matchId === "string" ? `/chat/${n.payload.matchId}` : "/matches",
      };
    case "superlike":
      return { emoji: "⭐", text: "Вам поставили суперлайк", href: "/likes" };
    case "like":
      return { emoji: "💛", text: "Вы кому-то понравились", href: "/likes" };
    case "premium":
      return { emoji: "👑", text: `Premium оформлен: ${String(n.payload.title ?? "")}`, href: "/premium" };
    case "boost":
      return { emoji: "⚡", text: "Буст включён — вы первыми в ленте", href: "/profile" };
    default:
      return { emoji: "🔔", text: "Новое уведомление", href: "/discover" };
  }
}

export function NotificationsScreen() {
  const { mutate: mutateGlobal } = useSWRConfig();
  const { data, error, isLoading, mutate } = useSWR<{ notifications: NotificationDto[] }>(KEYS.notifications, fetcher);

  // Открыл список — значит, прочитал: гасим бейдж
  const hasUnread = data?.notifications.some((n) => !n.read) ?? false;
  useEffect(() => {
    if (!hasUnread) return;
    void api(KEYS.notifications, { method: "POST" }).then(() => mutateGlobal(KEYS.counters));
  }, [hasUnread, mutateGlobal]);

  return (
    <Screen title="Уведомления" back="/discover">
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : error || !data ? (
        <ErrorState message={error ? errorMessage(error) : undefined} onRetry={() => mutate()} />
      ) : data.notifications.length === 0 ? (
        <EmptyState emoji="🔔" title="Пока тихо" text="Здесь появятся новые пары, лайки и покупки.">
          <LinkButton href="/discover">В ленту</LinkButton>
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.notifications.map((notification) => {
            const { emoji, text, href } = describe(notification);
            return (
              <li key={notification.id}>
                <Link
                  href={href}
                  className={clsx(
                    "flex items-center gap-3.5 rounded-2xl p-3.5 ring-1 transition hover:bg-surface-2",
                    notification.read ? "bg-surface ring-line" : "bg-brand-soft ring-brand/40",
                  )}
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xl" aria-hidden>
                    {emoji}
                  </span>
                  <span className="min-w-0 flex-1 text-[15px] leading-snug font-medium">{text}</span>
                  <span className="shrink-0 text-xs text-faint">{formatListTime(notification.createdAt)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Screen>
  );
}

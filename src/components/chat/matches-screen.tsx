"use client";

import Link from "next/link";
import useSWR from "swr";
import { NotificationsLink, Screen } from "@/components/screen";
import { LinkButton } from "@/components/ui/button";
import { Avatar, Badge, EmptyState, ErrorState, Photo, Skeleton } from "@/components/ui/misc";
import { errorMessage, fetcher } from "@/lib/client/api";
import { formatListTime } from "@/lib/client/format";
import { KEYS } from "@/lib/client/hooks";
import type { MatchPreview } from "@/lib/shared/types";

/** Список пар: сверху новые (ещё без переписки), ниже — диалоги. */
export function MatchesScreen() {
  const { data, error, isLoading, mutate } = useSWR<{ matches: MatchPreview[] }>(KEYS.matches, fetcher, {
    refreshInterval: 10_000,
  });

  const matches = data?.matches ?? [];
  const fresh = matches.filter((m) => !m.lastMessage);
  const chats = matches.filter((m) => m.lastMessage);

  return (
    <Screen title="Чаты" actions={<NotificationsLink />}>
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-18" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => mutate()} />
      ) : matches.length === 0 ? (
        <EmptyState
          emoji="💬"
          title="Здесь будут ваши пары"
          text="Когда симпатия окажется взаимной, появится чат. Начните с ленты."
        >
          <LinkButton href="/discover">Смотреть анкеты</LinkButton>
        </EmptyState>
      ) : (
        <>
          {fresh.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-3 text-xs font-bold tracking-wider text-faint uppercase">Новые пары</h2>
              <ul className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
                {fresh.map((match) => (
                  <li key={match.id} className="shrink-0">
                    <Link href={`/chat/${match.id}`} className="group flex w-20 flex-col items-center gap-2">
                      <span className="rounded-[1.6rem] bg-spark p-[3px]">
                        <Photo
                          photo={match.user.photo}
                          alt={match.user.name}
                          className="size-[74px] rounded-[1.4rem] ring-2 ring-bg transition group-hover:scale-95"
                        />
                      </span>
                      <span className="w-full truncate text-center text-xs font-semibold">{match.user.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {chats.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-bold tracking-wider text-faint uppercase">Сообщения</h2>
              <ul className="-mx-2 flex flex-col">
                {chats.map((match) => (
                  <li key={match.id}>
                    <Link
                      href={`/chat/${match.id}`}
                      className="flex items-center gap-3.5 rounded-2xl px-2 py-2.5 transition hover:bg-surface"
                    >
                      <Avatar photo={match.user.photo} name={match.user.name} size={56} online={match.user.online} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className="truncate text-[15px] font-bold">
                            {match.user.name}, {match.user.age}
                          </span>
                          <span className="ml-auto shrink-0 text-xs text-faint">
                            {formatListTime(match.lastMessage!.createdAt)}
                          </span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-2">
                          <span
                            className={
                              match.unread > 0
                                ? "truncate text-sm font-semibold text-fg"
                                : "truncate text-sm text-muted"
                            }
                          >
                            {match.lastMessage!.mine && <span className="text-faint">Вы: </span>}
                            {match.lastMessage!.body}
                          </span>
                          <Badge count={match.unread} className="ml-auto shrink-0" />
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </Screen>
  );
}

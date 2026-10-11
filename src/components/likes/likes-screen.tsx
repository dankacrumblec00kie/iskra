"use client";

import { Crown, Heart, Lock, Star, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { reachGoal } from "@/components/analytics";
import { MatchModal } from "@/components/discover/match-modal";
import { NotificationsLink, Screen } from "@/components/screen";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, ErrorState, Photo, Skeleton } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, fetcher } from "@/lib/client/api";
import { KEYS, useMe } from "@/lib/client/hooks";
import { formatDistance, plural } from "@/lib/shared/geo";
import type { LikesResponse, ProfileCard, SwipeAction, SwipeResult } from "@/lib/shared/types";

/** «Лайки»: кому я нравлюсь. Без подписки — размытые превью и предложение Premium. */
export function LikesScreen() {
  const toast = useToast();
  const { mutate: mutateGlobal } = useSWRConfig();
  const { data: me } = useMe();
  const { data, error, isLoading, mutate } = useSWR<LikesResponse>(KEYS.likes, fetcher);
  const [match, setMatch] = useState<SwipeResult["match"]>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function respond(card: ProfileCard, action: SwipeAction) {
    setBusy(card.id);
    try {
      const result = await api<SwipeResult>("/api/swipes", {
        method: "POST",
        body: { toUserId: card.id, action },
      });
      await mutate(
        (current) =>
          current && {
            ...current,
            count: current.count - 1,
            cards: current.cards.filter((c) => c.id !== card.id),
          },
        { revalidate: false },
      );
      void mutateGlobal(KEYS.counters);
      if (result.match) {
        setMatch(result.match);
        reachGoal("match");
        void mutateGlobal(KEYS.matches);
      }
    } catch (e) {
      toast(errorMessage(e), "error");
    }
    setBusy(null);
  }

  return (
    <Screen wide title="Лайки" actions={<NotificationsLink />}>
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="aspect-[3/4]" />
          ))}
        </div>
      ) : error || !data ? (
        <ErrorState message={error ? errorMessage(error) : undefined} onRetry={() => mutate()} />
      ) : data.count === 0 ? (
        <EmptyState
          emoji="💛"
          title="Пока нет новых симпатий"
          text="Лайкайте анкеты в ленте — так вас увидят чаще. Здесь появятся те, кому вы понравились."
        >
          <LinkButton href="/discover">Открыть ленту</LinkButton>
        </EmptyState>
      ) : data.unlocked ? (
        <>
          <p className="mb-4 text-sm text-muted">
            {data.count} {plural(data.count, ["человек ждёт", "человека ждут", "человек ждут"])} вашего ответа
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {data.cards.map((card) => (
              <li key={card.id} className="relative aspect-[3/4] overflow-hidden rounded-3xl bg-surface-2 ring-1 ring-white/5">
                <Link href={`/u/${card.id}`} className="block size-full">
                  <Photo photo={card.photos[0]} alt={`${card.name}, ${card.age}`} className="size-full" />
                </Link>
                {card.superLikedYou && (
                  <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-super px-2.5 py-1 text-[11px] font-bold text-black">
                    <Star className="size-3 fill-current" /> Суперлайк
                  </span>
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-3 pt-12 pb-3">
                  <div className="truncate text-[15px] font-bold">
                    {card.name}, {card.age}
                  </div>
                  <div className="truncate text-xs text-white/75">
                    {[formatDistance(card.distanceKm), card.city].filter(Boolean).join(" · ")}
                  </div>
                  <div className="pointer-events-auto mt-2.5 flex gap-2">
                    <button
                      type="button"
                      disabled={busy === card.id}
                      onClick={() => respond(card, "pass")}
                      aria-label={`Пропустить: ${card.name}`}
                      className="flex h-10 flex-1 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25 disabled:opacity-50"
                    >
                      <X className="size-5" />
                    </button>
                    <button
                      type="button"
                      disabled={busy === card.id}
                      onClick={() => respond(card, "like")}
                      aria-label={`Лайкнуть в ответ: ${card.name}`}
                      className="flex h-10 flex-1 items-center justify-center rounded-full bg-spark text-white transition hover:brightness-110 disabled:opacity-50"
                    >
                      <Heart className="size-5 fill-current" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <div className="mb-5 rounded-3xl bg-spark p-5 text-white sm:flex sm:items-center sm:gap-5">
            <div className="flex-1">
              <Crown className="size-7" />
              <h2 className="mt-2 font-display text-lg leading-snug font-bold">
                Вы понравились {data.count} {plural(data.count, ["человеку", "людям", "людям"])}
              </h2>
              <p className="mt-1 text-sm text-white/90">
                Откройте список с Premium и отвечайте взаимностью в один тап. Или листайте ленту — они там тоже есть.
              </p>
            </div>
            <LinkButton href="/premium" variant="gold" className="mt-4 w-full sm:mt-0 sm:w-auto">
              Открыть симпатии
            </LinkButton>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Скрытые симпатии">
            {data.teasers.map((teaser, i) => (
              <li key={i}>
                <Link
                  href="/premium"
                  aria-label="Скрытая анкета — доступна с Premium"
                  className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-3xl bg-surface-2 bg-cover bg-center ring-1 ring-white/5"
                  // Сервер присылает только крошечное размытое превью: настоящего фото в ответе нет
                  style={teaser.blur ? { backgroundImage: `url(${teaser.blur})` } : undefined}
                >
                  <span className="absolute inset-0 backdrop-blur-md" />
                  <span className="relative flex size-12 items-center justify-center rounded-full bg-black/55 backdrop-blur">
                    {teaser.superlike ? <Star className="size-5 fill-super text-super" /> : <Lock className="size-5" />}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <MatchModal match={match} myPhoto={me?.photos[0] ?? null} onClose={() => setMatch(null)} />
    </Screen>
  );
}

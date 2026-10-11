"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWRInfinite from "swr/infinite";
import { FiltersSheet } from "@/components/discover/filters-sheet";
import { NotificationsLink, Screen } from "@/components/screen";
import { Button, IconButton } from "@/components/ui/button";
import { EmptyState, ErrorState, Photo, Skeleton } from "@/components/ui/misc";
import { errorMessage, fetcher } from "@/lib/client/api";
import {
  countActive,
  filtersQuery,
  setSessionFilters,
  useSearchVersion,
  useSessionFilters,
} from "@/lib/client/filters-store";
import { useDebounced } from "@/lib/client/hooks";
import { formatDistance } from "@/lib/shared/geo";
import type { ProfileCard } from "@/lib/shared/types";

type Page = { cards: ProfileCard[]; nextCursor: number | null };

/** «Рядом»: сетка анкет по возрастанию расстояния с поиском, фильтрами и подгрузкой. */
export function NearbyScreen() {
  const filters = useSessionFilters();
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const q = useDebounced(query.trim());
  const searchVersion = useSearchVersion();

  const { data, error, isLoading, isValidating, size, setSize, mutate } = useSWRInfinite<Page>(
    (index, previous) => {
      if (previous && previous.nextCursor === null) return null;
      const search = filtersQuery(filters, { q, cursor: index === 0 ? undefined : (previous?.nextCursor ?? undefined) });
      // Версия настроек поиска — часть ключа: после их сохранения список загрузится заново
      return `/api/nearby${search}#${searchVersion}`;
    },
    (key: string) => fetcher<Page>(key.split("#")[0]),
    { revalidateFirstPage: false, revalidateOnFocus: false },
  );

  const cards = data?.flatMap((page) => page.cards) ?? [];
  const hasMore = data ? data[data.length - 1]?.nextCursor !== null : false;
  const loadingMore = isValidating && size > (data?.length ?? 0);
  const activeFilters = countActive(filters);

  return (
    <Screen
      wide
      title="Рядом"
      actions={
        <>
          <IconButton label="Фильтры" onClick={() => setFiltersOpen(true)} className="relative">
            <SlidersHorizontal className="size-5" />
            {activeFilters > 0 && (
              <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
                {activeFilters}
              </span>
            )}
          </IconButton>
          <NotificationsLink />
        </>
      }
    >
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-faint" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Имя, профессия, интерес, город"
          aria-label="Поиск по анкетам"
          maxLength={60}
          className="h-12 w-full rounded-full border border-line bg-surface pr-12 pl-12 text-[15px] placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/25 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Очистить поиск"
            className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-faint hover:text-fg"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-[3/4]" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => mutate()} />
      ) : cards.length === 0 ? (
        <EmptyState
          emoji={q ? "🔎" : "🧭"}
          title={q ? "Никого не нашли" : "Рядом пока никого"}
          text={
            q
              ? `По запросу «${q}» нет подходящих анкет. Попробуйте другое слово.`
              : "Увеличьте расстояние или диапазон возраста в фильтрах."
          }
        >
          {activeFilters > 0 && (
            <Button variant="secondary" onClick={() => setSessionFilters({ goal: null, interests: [], online: false })}>
              Сбросить фильтры
            </Button>
          )}
          <Button onClick={() => setFiltersOpen(true)}>Открыть фильтры</Button>
        </EmptyState>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {cards.map((card) => (
              <li key={card.id}>
                <PersonTile card={card} />
              </li>
            ))}
          </ul>
          {hasMore && (
            <Button variant="secondary" className="mx-auto mt-6" loading={loadingMore} onClick={() => setSize(size + 1)}>
              Показать ещё
            </Button>
          )}
        </>
      )}

      <FiltersSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </Screen>
  );
}

export function PersonTile({ card }: { card: ProfileCard }) {
  return (
    <Link
      href={`/u/${card.id}`}
      className="group relative block aspect-[3/4] overflow-hidden rounded-3xl bg-surface-2 ring-1 ring-white/5 transition hover:ring-brand/60"
    >
      <Photo
        photo={card.photos[0]}
        alt={`${card.name}, ${card.age}`}
        className="size-full transition duration-300 group-hover:scale-105"
      />
      {card.matchId ? (
        <span className="absolute top-2.5 left-2.5 rounded-full bg-spark px-2.5 py-1 text-[11px] font-bold text-white">Пара</span>
      ) : card.myAction && card.myAction !== "pass" ? (
        <span className="absolute top-2.5 left-2.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
          Вы лайкнули
        </span>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pt-10 pb-3">
        <div className="flex items-center gap-1.5 text-[15px] font-bold">
          <span className="truncate">
            {card.name}, {card.age}
          </span>
          {card.online && <span className="size-2 shrink-0 rounded-full bg-like" title="В сети" />}
        </div>
        <div className="truncate text-xs text-white/75">
          {[formatDistance(card.distanceKm), card.city].filter(Boolean).join(" · ")}
        </div>
      </div>
    </Link>
  );
}

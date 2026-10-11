"use client";

import clsx from "clsx";
import { Heart, RotateCcw, SlidersHorizontal, Star, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { reachGoal } from "@/components/analytics";
import { Logo } from "@/components/logo";
import { Paywall, type PaywallReason } from "@/components/premium/paywall";
import { ProfileDetails } from "@/components/profile/profile-details";
import { ReportSheet } from "@/components/profile/report-sheet";
import { NotificationsLink } from "@/components/screen";
import { Button, IconButton, LinkButton } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { api, ApiRequestError, errorMessage, fetcher } from "@/lib/client/api";
import { countActive, filtersQuery, setSessionFilters, useSessionFilters } from "@/lib/client/filters-store";
import { KEYS, useMe } from "@/lib/client/hooks";
import { LIMITS } from "@/lib/shared/constants";
import type { Me, ProfileCard, SwipeAction, SwipeResult } from "@/lib/shared/types";
import { FiltersSheet } from "./filters-sheet";
import { MatchModal } from "./match-modal";
import { SwipeCard, type SwipeCardHandle } from "./swipe-card";

const DECK_SIZE = 20;

export function SwipeDeck() {
  const toast = useToast();
  const { mutate: mutateGlobal } = useSWRConfig();
  const { data: me, mutate: mutateMe } = useMe();
  const filters = useSessionFilters();
  const profile = me?.profile;

  // Ключ включает сохранённые настройки поиска: изменились — лента загружается заново
  const key = profile
    ? `/api/discover${filtersQuery(filters)}#${profile.lookingFor}:${profile.ageMin}:${profile.ageMax}:${profile.maxDistanceKm}`
    : null;
  const { data, error, isLoading, isValidating, mutate } = useSWR<{ cards: ProfileCard[] }>(
    key,
    (k: string) => fetcher(k.split("#")[0]),
    { revalidateOnFocus: false, revalidateIfStale: false },
  );

  // Анкеты, уже убранные из стопки в этом сеансе (свайп ушёл на сервер или в пути)
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [inflight, setInflight] = useState(0);
  const [match, setMatch] = useState<SwipeResult["match"]>(null);
  const [paywall, setPaywall] = useState<PaywallReason | null>(null);
  const [details, setDetails] = useState<ProfileCard | null>(null);
  const [reporting, setReporting] = useState<ProfileCard | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [canRewind, setCanRewind] = useState(false);
  const [rewinding, setRewinding] = useState(false);
  const topCard = useRef<SwipeCardHandle>(null);

  const cards = (data?.cards ?? []).filter((card) => !removed.has(card.id));
  const top = cards[0];
  const mayHaveMore = (data?.cards.length ?? 0) >= DECK_SIZE;

  // Стопка заканчивается — подгружаем следующую порцию, когда все свайпы дошли до сервера
  useEffect(() => {
    if (cards.length <= 3 && mayHaveMore && inflight === 0 && !isValidating) void mutate();
  }, [cards.length, mayHaveMore, inflight, isValidating, mutate]);

  const restore = (id: string) =>
    setRemoved((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });

  async function handleSwiped(card: ProfileCard, action: SwipeAction) {
    setRemoved((current) => new Set(current).add(card.id));
    setInflight((n) => n + 1);
    try {
      const result = await api<SwipeResult>("/api/swipes", {
        method: "POST",
        body: { toUserId: card.id, action },
      });
      void mutateMe((current) => (current ? { ...current, limits: result.limits } : current), {
        revalidate: false,
      });
      setCanRewind(true);
      if (result.match) {
        setMatch(result.match);
        reachGoal("match");
        void mutateGlobal(KEYS.matches);
      }
    } catch (e) {
      // Свайп не засчитан — возвращаем анкету в стопку
      restore(card.id);
      if (e instanceof ApiRequestError && e.code === "LIKES_LIMIT") setPaywall("likes");
      else if (e instanceof ApiRequestError && e.code === "SUPERLIKES_LIMIT") setPaywall("superlikes");
      else toast(errorMessage(e), "error");
    } finally {
      setInflight((n) => n - 1);
    }
  }

  const act = useCallback(
    (action: SwipeAction) => {
      if (!me || !topCard.current) return;
      // Лимиты известны заранее: не анимируем свайп, который сервер всё равно отклонит
      if (action !== "pass" && me.limits.likesLeft === 0) return setPaywall("likes");
      if (action === "superlike" && me.limits.superlikesLeft === 0) return setPaywall("superlikes");
      topCard.current.fling(action);
    },
    [me],
  );

  async function rewind() {
    if (!me?.isPremium) return setPaywall("rewind");
    setRewinding(true);
    try {
      const { card } = await api<{ card: ProfileCard | null }>("/api/swipes", { method: "DELETE" });
      if (card) {
        restore(card.id);
        await mutate(
          (current) =>
            current && !current.cards.some((c) => c.id === card.id)
              ? { cards: [card, ...current.cards] }
              : current,
          { revalidate: false },
        );
      }
      void mutateMe();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
    setCanRewind(false);
    setRewinding(false);
  }

  // Стрелки на клавиатуре: ← пропустить, → лайк, ↑ суперлайк
  const overlayOpen = Boolean(match || paywall || details || reporting || filtersOpen);
  useEffect(() => {
    if (overlayOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "ArrowLeft") act("pass");
      else if (event.key === "ArrowRight") act("like");
      else if (event.key === "ArrowUp") act("superlike");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlayOpen, act]);

  const activeFilters = countActive(filters);
  const loading = isLoading || !me;
  const refilling = cards.length === 0 && (isValidating || inflight > 0) && mayHaveMore;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-lg flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-4">
      <header className="flex h-14 shrink-0 items-center gap-1 px-4 lg:h-16">
        <Logo size="sm" className="lg:hidden" />
        <h1 className="hidden font-display text-xl font-bold lg:block">Лента</h1>
        <span className="flex-1" />
        {me && me.limits.likesLeft !== null && (
          <span className="mr-1 hidden text-xs text-faint sm:inline" title="Осталось лайков на сегодня">
            💛 {me.limits.likesLeft} / {LIMITS.freeLikesPerDay}
          </span>
        )}
        <IconButton label="Фильтры" onClick={() => setFiltersOpen(true)} className="relative">
          <SlidersHorizontal className="size-5" />
          {activeFilters > 0 && (
            <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
              {activeFilters}
            </span>
          )}
        </IconButton>
        <NotificationsLink />
      </header>

      <div className="relative mx-4 min-h-0 flex-1">
        {loading || refilling ? (
          <Skeleton className="absolute inset-0 rounded-card" />
        ) : error ? (
          <div className="absolute inset-0 flex rounded-card bg-surface">
            <ErrorState message={errorMessage(error)} onRetry={() => mutate()} />
          </div>
        ) : cards.length === 0 ? (
          <div className="absolute inset-0 flex rounded-card bg-surface ring-1 ring-line">
            <EmptyState
              emoji="🌙"
              title="Анкеты закончились"
              text={
                activeFilters > 0
                  ? "Под выбранные фильтры больше никого нет. Попробуйте их ослабить."
                  : "Вы посмотрели всех, кто подходит под настройки поиска. Расширьте возраст или расстояние — или загляните позже."
              }
            >
              {activeFilters > 0 && (
                <Button variant="secondary" onClick={() => setSessionFilters({ goal: null, interests: [], online: false })}>
                  Сбросить фильтры
                </Button>
              )}
              <Button onClick={() => setFiltersOpen(true)}>Настроить поиск</Button>
              <LinkButton href="/nearby" variant="ghost">
                Люди рядом
              </LinkButton>
            </EmptyState>
          </div>
        ) : (
          cards
            .slice(0, 3)
            .reverse()
            .map((card) => {
              const depth = cards.indexOf(card);
              return (
                <SwipeCard
                  key={card.id}
                  ref={depth === 0 ? topCard : undefined}
                  card={card}
                  depth={depth}
                  onSwiped={(action) => handleSwiped(card, action)}
                  onOpen={() => setDetails(card)}
                />
              );
            })
        )}
      </div>

      <div className="flex shrink-0 items-center justify-center gap-4 px-4 pt-4 pb-2">
        <ActionButton
          label="Вернуть последнюю анкету"
          onClick={rewind}
          disabled={!canRewind || rewinding}
          className="size-12 text-gold ring-gold/40"
        >
          <RotateCcw className="size-5" />
        </ActionButton>
        <ActionButton label="Пропустить" onClick={() => act("pass")} disabled={!top} className="size-16 text-nope ring-nope/40">
          <X className="size-8" strokeWidth={2.6} />
        </ActionButton>
        <ActionButton
          label={`Суперлайк, осталось ${me?.limits.superlikesLeft ?? 0}`}
          onClick={() => act("superlike")}
          disabled={!top}
          className="size-12 text-super ring-super/40"
        >
          <Star className="size-5 fill-current" />
        </ActionButton>
        <ActionButton
          label="Нравится"
          onClick={() => act("like")}
          disabled={!top}
          className="size-16 bg-spark text-white ring-transparent glow-brand"
        >
          <Heart className="size-8 fill-current" />
        </ActionButton>
      </div>

      <Sheet open={details !== null} onClose={() => setDetails(null)} bare size="md">
        {details && (
          <>
            <ProfileDetails
              card={details}
              onReport={() => {
                setReporting(details);
                setDetails(null);
              }}
            />
            <div className="sticky bottom-0 flex justify-center gap-4 bg-gradient-to-t from-surface via-surface to-transparent px-5 pt-8 pb-5">
              {(["pass", "superlike", "like"] as const).map((action) => (
                <ActionButton
                  key={action}
                  label={action === "pass" ? "Пропустить" : action === "like" ? "Нравится" : "Суперлайк"}
                  onClick={() => {
                    setDetails(null);
                    // Даём окну закрыться, затем анимируем карточку
                    setTimeout(() => act(action), 150);
                  }}
                  className={clsx(
                    action === "pass" && "size-14 text-nope ring-nope/40",
                    action === "superlike" && "size-12 self-center text-super ring-super/40",
                    action === "like" && "size-14 bg-spark text-white ring-transparent",
                  )}
                >
                  {action === "pass" && <X className="size-7" strokeWidth={2.6} />}
                  {action === "superlike" && <Star className="size-5 fill-current" />}
                  {action === "like" && <Heart className="size-7 fill-current" />}
                </ActionButton>
              ))}
            </div>
          </>
        )}
      </Sheet>

      {reporting && (
        <ReportSheet
          open
          user={reporting}
          onClose={() => setReporting(null)}
          onDone={() => setRemoved((current) => new Set(current).add(reporting.id))}
        />
      )}
      <FiltersSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} />
      <Paywall reason={paywall} onClose={() => setPaywall(null)} />
      <MatchModal match={match} myPhoto={(me as Me | undefined)?.photos[0] ?? null} onClose={() => setMatch(null)} />
    </div>
  );
}

function ActionButton({
  label,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-full bg-surface-2 ring-1 transition",
        "hover:scale-110 active:scale-95 disabled:pointer-events-none disabled:opacity-35",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

"use client";

import { Heart, MessageCircle, Star, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { reachGoal } from "@/components/analytics";
import { MatchModal } from "@/components/discover/match-modal";
import { Paywall, type PaywallReason } from "@/components/premium/paywall";
import { Screen } from "@/components/screen";
import { Button, LinkButton } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api, ApiRequestError, errorMessage, fetcher } from "@/lib/client/api";
import { KEYS, useMe } from "@/lib/client/hooks";
import type { ProfileCard, SwipeAction, SwipeResult } from "@/lib/shared/types";
import { ProfileDetails } from "./profile-details";
import { ReportSheet } from "./report-sheet";

/** Чужая анкета целиком, с действиями: лайк, суперлайк, пропустить или написать. */
export function UserProfileScreen({ userId }: { userId: string }) {
  const router = useRouter();
  const toast = useToast();
  const { mutate: mutateGlobal } = useSWRConfig();
  const { data: me, mutate: mutateMe } = useMe();
  const { data: card, error, isLoading, mutate } = useSWR<ProfileCard, ApiRequestError>(
    `/api/users/${userId}`,
    fetcher,
    { shouldRetryOnError: (e) => e.status !== 404, revalidateOnFocus: false },
  );

  const [pending, setPending] = useState<SwipeAction | null>(null);
  const [match, setMatch] = useState<SwipeResult["match"]>(null);
  const [paywall, setPaywall] = useState<PaywallReason | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  async function act(action: SwipeAction) {
    if (!card) return;
    setPending(action);
    try {
      const result = await api<SwipeResult>("/api/swipes", {
        method: "POST",
        body: { toUserId: card.id, action },
      });
      void mutateMe((current) => (current ? { ...current, limits: result.limits } : current), { revalidate: false });
      void mutateGlobal(KEYS.counters);
      await mutate({ ...card, myAction: action, matchId: result.match?.id ?? card.matchId }, { revalidate: false });
      if (result.match) {
        setMatch(result.match);
        reachGoal("match");
        void mutateGlobal(KEYS.matches);
      } else if (action === "pass") {
        router.back();
      } else {
        toast(action === "superlike" ? "Суперлайк отправлен ⭐" : "Лайк отправлен 💛", "success");
      }
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === "LIKES_LIMIT") setPaywall("likes");
      else if (e instanceof ApiRequestError && e.code === "SUPERLIKES_LIMIT") setPaywall("superlikes");
      else toast(errorMessage(e), "error");
    }
    setPending(null);
  }

  return (
    <Screen title={card ? `${card.name}, ${card.age}` : "Анкета"} back="/nearby" flush>
      {isLoading ? (
        <div className="px-4">
          <Skeleton className="aspect-[3/4] w-full" />
          <Skeleton className="mt-5 h-8 w-2/3" />
          <Skeleton className="mt-3 h-20 w-full" />
        </div>
      ) : error?.status === 404 ? (
        <EmptyState emoji="🫥" title="Анкета недоступна" text="Возможно, пользователь скрыл профиль или удалил аккаунт.">
          <LinkButton href="/discover">Вернуться в ленту</LinkButton>
        </EmptyState>
      ) : error || !card ? (
        <ErrorState message={error ? errorMessage(error) : undefined} onRetry={() => mutate()} />
      ) : (
        <>
          <div className="overflow-hidden sm:mx-4 sm:rounded-card sm:bg-surface sm:ring-1 sm:ring-line">
            <ProfileDetails card={card} onReport={() => setReportOpen(true)} />
          </div>

          {/* Панель действий закреплена над нижней навигацией */}
          <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 mt-4 flex justify-center gap-3 bg-gradient-to-t from-bg via-bg/95 to-transparent px-4 pt-8 pb-4 lg:bottom-0">
            {card.matchId ? (
              <LinkButton href={`/chat/${card.matchId}`} size="lg" className="w-full max-w-sm">
                <MessageCircle className="size-5" /> Написать
              </LinkButton>
            ) : card.myAction && card.myAction !== "pass" ? (
              <p className="rounded-full bg-surface-2 px-5 py-3 text-sm font-semibold text-muted">
                {card.myAction === "superlike" ? "⭐ Суперлайк отправлен" : "💛 Лайк отправлен"} — ждём ответа
              </p>
            ) : (
              <>
                <Button
                  variant="secondary"
                  size="lg"
                  loading={pending === "pass"}
                  disabled={pending !== null}
                  onClick={() => act("pass")}
                  icon={<X className="size-5 text-nope" />}
                >
                  Пропустить
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  loading={pending === "superlike"}
                  disabled={pending !== null}
                  onClick={() => (me?.limits.superlikesLeft === 0 ? setPaywall("superlikes") : act("superlike"))}
                  aria-label="Суперлайк"
                  className="px-4"
                >
                  <Star className="size-5 fill-super text-super" />
                </Button>
                <Button
                  size="lg"
                  loading={pending === "like"}
                  disabled={pending !== null}
                  onClick={() => (me?.limits.likesLeft === 0 ? setPaywall("likes") : act("like"))}
                  icon={<Heart className="size-5 fill-current" />}
                >
                  Нравится
                </Button>
              </>
            )}
          </div>

          <ReportSheet
            open={reportOpen}
            user={card}
            onClose={() => setReportOpen(false)}
            onDone={() => {
              void mutateGlobal(KEYS.matches);
              router.replace("/discover");
            }}
          />
        </>
      )}

      <Paywall reason={paywall} onClose={() => setPaywall(null)} />
      <MatchModal match={match} myPhoto={me?.photos[0] ?? null} onClose={() => setMatch(null)} />
    </Screen>
  );
}

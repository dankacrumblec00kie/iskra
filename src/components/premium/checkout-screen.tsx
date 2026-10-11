"use client";

import { CircleAlert, CreditCard, Lock, PartyPopper } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { reachGoal } from "@/components/analytics";
import { Screen } from "@/components/screen";
import { Button, LinkButton } from "@/components/ui/button";
import { EmptyState, ErrorState, ScreenLoader, Spinner } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api, ApiRequestError, errorMessage, fetcher } from "@/lib/client/api";
import { KEYS } from "@/lib/client/hooks";
import { formatPrice } from "@/lib/shared/products";

type PaymentStatus = {
  id: string;
  status: "pending" | "succeeded" | "canceled";
  provider: "demo" | "yookassa";
  amountMinor: number;
  product: { id: string; kind: "premium" | "boost"; title: string } | null;
};

/**
 * Страница оплаты. В демо-режиме — тестовая касса с кнопкой «Оплатить»;
 * для ЮKassa сюда возвращается пользователь после оплаты, и страница ждёт подтверждения.
 */
export function CheckoutScreen({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const toast = useToast();
  const { mutate: mutateGlobal } = useSWRConfig();
  const key = `/api/billing/payments/${paymentId}`;
  const [busy, setBusy] = useState<"pay" | "cancel" | null>(null);

  const { data, error, mutate } = useSWR<PaymentStatus, ApiRequestError>(key, fetcher, {
    // Внешний платёж подтверждается не мгновенно — опрашиваем статус
    refreshInterval: (current) => (current?.status === "pending" && current.provider === "yookassa" ? 3000 : 0),
    shouldRetryOnError: (e) => e.status !== 404,
    revalidateOnFocus: false,
  });

  // После успешной оплаты обновляем всё, что зависит от подписки
  const succeeded = data?.status === "succeeded";
  useEffect(() => {
    if (!succeeded) return;
    reachGoal("purchase");
    void mutateGlobal(KEYS.me);
    void mutateGlobal(KEYS.likes);
    void mutateGlobal(KEYS.counters);
  }, [succeeded, mutateGlobal]);

  async function pay() {
    setBusy("pay");
    try {
      await mutate(await api<PaymentStatus>(key, { method: "POST" }), { revalidate: false });
    } catch (e) {
      toast(errorMessage(e), "error");
    }
    setBusy(null);
  }

  async function cancel() {
    setBusy("cancel");
    try {
      await api(key, { method: "DELETE" });
      router.replace("/premium");
    } catch (e) {
      toast(errorMessage(e), "error");
      setBusy(null);
    }
  }

  if (error?.status === 404) {
    return (
      <Screen title="Оплата" back="/premium">
        <EmptyState emoji="🧾" title="Платёж не найден" text="Возможно, ссылка устарела. Оформите покупку заново.">
          <LinkButton href="/premium">К тарифам</LinkButton>
        </EmptyState>
      </Screen>
    );
  }
  if (error && !data) {
    return (
      <Screen title="Оплата" back="/premium">
        <ErrorState message={error.message} onRetry={() => mutate()} />
      </Screen>
    );
  }
  if (!data) return <ScreenLoader />;

  const title = data.product ? (data.product.kind === "premium" ? `Premium · ${data.product.title}` : data.product.title) : "Покупка";

  if (data.status === "succeeded") {
    const premium = data.product?.kind === "premium";
    return (
      <Screen title="Готово">
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <span className="flex size-24 animate-pop items-center justify-center rounded-full bg-spark">
            <PartyPopper className="size-11 text-white" />
          </span>
          <h2 className="mt-7 animate-slide-up font-display text-2xl font-bold">Оплата прошла</h2>
          <p className="mt-2 max-w-xs animate-slide-up text-muted">
            {premium
              ? "Premium уже работает: симпатии открыты, лайки без лимита."
              : "Буст включён — ваша анкета поднялась в ленте у людей рядом."}
          </p>
          <LinkButton href={premium ? "/likes" : "/discover"} size="lg" className="mt-8 w-full max-w-xs">
            {premium ? "Посмотреть, кто лайкнул" : "В ленту"}
          </LinkButton>
        </div>
      </Screen>
    );
  }

  if (data.status === "canceled") {
    return (
      <Screen title="Оплата" back="/premium">
        <EmptyState emoji="↩️" title="Платёж отменён" text="Деньги не списаны. Можно попробовать ещё раз.">
          <LinkButton href="/premium">К тарифам</LinkButton>
        </EmptyState>
      </Screen>
    );
  }

  if (data.provider === "yookassa") {
    return (
      <Screen title="Оплата" back="/premium">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
          <Spinner className="size-9 text-brand" />
          <h2 className="font-display text-xl font-bold">Ждём подтверждения</h2>
          <p className="max-w-xs text-sm text-muted">
            Как только платёжный сервис сообщит об оплате, доступ откроется автоматически. Обычно это занимает несколько секунд.
          </p>
        </div>
      </Screen>
    );
  }

  return (
    <Screen title="Оплата" back="/premium">
      <div className="mx-auto w-full max-w-md">
        <p className="flex items-start gap-2.5 rounded-2xl bg-gold/10 px-4 py-3 text-sm leading-snug text-gold">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          Тестовая касса. Это учебный проект: настоящие деньги не списываются, данные карты не нужны.
        </p>

        <section className="mt-4 rounded-card bg-surface p-5 ring-1 ring-line">
          <div className="text-xs font-bold tracking-wider text-faint uppercase">Заказ</div>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <span className="text-[15px] font-semibold">{title}</span>
            <span className="font-display text-xl font-bold">{formatPrice(data.amountMinor)}</span>
          </div>

          {/* Декоративная карта: показывает, как выглядела бы форма, но ничего не принимает */}
          <div className="mt-5 rounded-2xl bg-gradient-to-br from-surface-3 to-surface-2 p-4 ring-1 ring-line" aria-hidden>
            <CreditCard className="size-7 text-muted" />
            <div className="mt-5 font-mono text-lg tracking-widest text-fg/80">4242 4242 4242 4242</div>
            <div className="mt-2 flex justify-between text-xs text-faint">
              <span>TEST CARD</span>
              <span>12 / 30</span>
            </div>
          </div>

          <Button size="lg" block className="mt-5" loading={busy === "pay"} disabled={busy !== null} onClick={pay}>
            Оплатить {formatPrice(data.amountMinor)}
          </Button>
          <Button variant="ghost" block className="mt-2" loading={busy === "cancel"} disabled={busy !== null} onClick={cancel}>
            Отменить
          </Button>
        </section>

        <p className="mt-4 flex items-center justify-center gap-2 text-xs text-faint">
          <Lock className="size-3.5" /> В боевом режиме оплата идёт через ЮKassa
        </p>
      </div>
    </Screen>
  );
}

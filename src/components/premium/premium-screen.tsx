"use client";

import clsx from "clsx";
import { Check, Crown, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { reachGoal } from "@/components/analytics";
import { Screen } from "@/components/screen";
import { Button } from "@/components/ui/button";
import { ScreenLoader } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client/api";
import { formatDate } from "@/lib/client/format";
import { useConfig, useMe } from "@/lib/client/hooks";
import { formatPrice, PREMIUM_FEATURES, PRODUCTS } from "@/lib/shared/products";

const PLANS = PRODUCTS.filter((product) => product.kind === "premium");
const BOOST = PRODUCTS.find((product) => product.kind === "boost")!;

export function PremiumScreen() {
  const router = useRouter();
  const toast = useToast();
  const { data: me } = useMe();
  const { data: config } = useConfig();
  const [selected, setSelected] = useState(PLANS[1].id);
  const [pending, setPending] = useState<string | null>(null);

  if (!me) return <ScreenLoader />;

  async function buy(productId: string) {
    setPending(productId);
    try {
      const { url } = await api<{ url: string }>("/api/billing/checkout", {
        method: "POST",
        body: { productId },
      });
      reachGoal("checkout_start");
      // Тестовая касса — внутренняя страница, настоящая — сайт платёжного сервиса
      if (url.startsWith("/")) router.push(url);
      else window.location.assign(url);
    } catch (error) {
      toast(errorMessage(error), "error");
      setPending(null);
    }
  }

  const plan = PLANS.find((p) => p.id === selected)!;
  const boostActive = me.profile?.boostedUntil ? new Date(me.profile.boostedUntil) > new Date() : false;

  return (
    <Screen title="Premium" back="/profile">
      <section className="relative overflow-hidden rounded-card bg-spark p-6 text-white">
        <Crown className="size-10" />
        <h2 className="mt-3 font-display text-2xl leading-tight font-bold">Искра Premium</h2>
        <p className="mt-2 max-w-sm text-sm text-white/90">
          {me.isPremium && me.premiumUntil
            ? `Подписка активна до ${formatDate(me.premiumUntil)}. Продление добавится к текущему сроку.`
            : "Больше симпатий, меньше ограничений. Отмена не нужна — подписка не продлевается сама."}
        </p>
        <span className="pointer-events-none absolute -right-6 -bottom-8 text-[9rem] leading-none opacity-20" aria-hidden>
          ✦
        </span>
      </section>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {PREMIUM_FEATURES.map((feature) => (
          <li key={feature.title} className="flex items-start gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
            <span className="text-2xl leading-7" aria-hidden>
              {feature.emoji}
            </span>
            <span>
              <span className="block text-[15px] font-bold">{feature.title}</span>
              <span className="mt-0.5 block text-sm leading-snug text-muted">{feature.text}</span>
            </span>
          </li>
        ))}
      </ul>

      <h3 className="mt-8 mb-3 font-display text-base font-bold">Выберите срок</h3>
      <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Срок подписки">
        {PLANS.map((item) => {
          const active = item.id === selected;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(item.id)}
              className={clsx(
                "relative flex flex-col items-center rounded-3xl border-2 px-2 pt-6 pb-4 text-center transition active:scale-[0.97]",
                active ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-white/25",
              )}
            >
              {item.badge && (
                <span className="absolute -top-2.5 rounded-full bg-gold px-2.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-black">
                  {item.badge}
                </span>
              )}
              <span className="text-sm font-semibold text-muted">{item.title}</span>
              <span className="mt-1.5 font-display text-lg font-bold sm:text-xl">{formatPrice(item.priceMinor)}</span>
              <span className="mt-1 text-xs text-faint">{item.description}</span>
              {active && (
                <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-brand">
                  <Check className="size-3.5 text-white" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Button size="lg" block className="mt-5" loading={pending === plan.id} disabled={pending !== null} onClick={() => buy(plan.id)}>
        {me.isPremium ? "Продлить" : "Оформить"} за {formatPrice(plan.priceMinor)}
      </Button>

      <section id="boost" className="mt-8 scroll-mt-20 rounded-card bg-surface p-5 ring-1 ring-line">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gold/15">
            <Zap className="size-6 text-gold" />
          </span>
          <div className="flex-1">
            <h3 className="font-display text-base font-bold">{BOOST.title}</h3>
            <p className="mt-1 text-sm leading-snug text-muted">
              {BOOST.description}. Работает и без подписки.
              {boostActive && " Сейчас буст уже активен — покупка продлит его."}
            </p>
          </div>
        </div>
        <Button
          variant="gold"
          block
          className="mt-4"
          loading={pending === BOOST.id}
          disabled={pending !== null}
          onClick={() => buy(BOOST.id)}
        >
          Включить за {formatPrice(BOOST.priceMinor)}
        </Button>
      </section>

      <p className="mt-6 text-center text-xs leading-relaxed text-faint">
        {config?.paymentProvider === "demo"
          ? "Демо-режим: оплата проходит через тестовую кассу, деньги не списываются."
          : "Оплата через ЮKassa. Разовый платёж без автопродления."}
      </p>
    </Screen>
  );
}

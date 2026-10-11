"use client";

import { Crown } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { PREMIUM_FEATURES } from "@/lib/shared/products";

export type PaywallReason = "likes" | "superlikes" | "rewind" | "who-liked";

const HEADLINES: Record<PaywallReason, { title: string; text: string }> = {
  likes: {
    title: "Лайки на сегодня закончились",
    text: "Бесплатно — 30 лайков в сутки. С Premium лимита нет.",
  },
  superlikes: {
    title: "Суперлайки закончились",
    text: "С Premium — 5 суперлайков каждый день.",
  },
  rewind: {
    title: "Вернуть анкету",
    text: "Случайно смахнули? С Premium последний свайп можно отменить.",
  },
  "who-liked": {
    title: "Узнайте, кому вы нравитесь",
    text: "С Premium список симпатий открыт: отвечайте взаимностью в один тап.",
  },
};

/** Окно с предложением подписки. Появляется, когда пользователь упёрся в ограничение. */
export function Paywall({ reason, onClose }: { reason: PaywallReason | null; onClose: () => void }) {
  const headline = reason ? HEADLINES[reason] : null;

  return (
    <Sheet open={reason !== null} onClose={onClose} title="Искра Premium" size="sm">
      {headline && (
        <>
          <div className="rounded-3xl bg-spark p-5 text-white">
            <Crown className="size-8" />
            <h3 className="mt-3 font-display text-lg leading-snug font-bold">{headline.title}</h3>
            <p className="mt-1.5 text-sm text-white/90">{headline.text}</p>
          </div>
          <ul className="mt-5 flex flex-col gap-3.5">
            {PREMIUM_FEATURES.map((feature) => (
              <li key={feature.title} className="flex items-start gap-3">
                <span className="text-xl leading-6" aria-hidden>
                  {feature.emoji}
                </span>
                <span>
                  <span className="block text-[15px] font-semibold">{feature.title}</span>
                  <span className="block text-sm text-muted">{feature.text}</span>
                </span>
              </li>
            ))}
          </ul>
          <LinkButton href="/premium" size="lg" block className="mt-6" onClick={onClose}>
            Выбрать тариф
          </LinkButton>
        </>
      )}
    </Sheet>
  );
}

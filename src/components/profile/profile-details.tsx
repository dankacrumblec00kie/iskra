"use client";

import clsx from "clsx";
import { Briefcase, ChevronLeft, ChevronRight, Crown, Flag, MapPin, Ruler, Star } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Photo, Tag } from "@/components/ui/misc";
import { GOAL_EMOJI, GOAL_LABEL } from "@/lib/shared/constants";
import { formatDistance } from "@/lib/shared/geo";
import { INTEREST_BY_SLUG } from "@/lib/shared/interests";
import type { PhotoDto, ProfileCard } from "@/lib/shared/types";

/** Листалка фотографий: полоски-индикаторы сверху, касание левой/правой половины листает. */
export function PhotoCarousel({
  photos,
  name,
  className,
  children,
}: {
  photos: PhotoDto[];
  name: string;
  className?: string;
  children?: ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const current = Math.min(index, Math.max(0, photos.length - 1));
  const go = (delta: number) => setIndex(Math.max(0, Math.min(photos.length - 1, current + delta)));

  return (
    <div className={clsx("relative overflow-hidden bg-surface-2", className)}>
      <Photo photo={photos[current]} alt={`${name}, фото ${current + 1}`} className="size-full" eager />

      {photos.length > 1 && (
        <>
          <div className="absolute inset-x-3 top-3 flex gap-1.5">
            {photos.map((photo, i) => (
              <span
                key={photo.id}
                className={clsx("h-1 flex-1 rounded-full", i === current ? "bg-white" : "bg-white/35")}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={current === 0}
            aria-label="Предыдущее фото"
            className="group absolute inset-y-0 left-0 flex w-1/3 items-center justify-start pl-2 disabled:opacity-0"
          >
            <ChevronLeft className="size-8 rounded-full bg-black/40 p-1.5 opacity-0 transition group-hover:opacity-100" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={current === photos.length - 1}
            aria-label="Следующее фото"
            className="group absolute inset-y-0 right-0 flex w-1/3 items-center justify-end pr-2 disabled:opacity-0"
          >
            <ChevronRight className="size-8 rounded-full bg-black/40 p-1.5 opacity-0 transition group-hover:opacity-100" />
          </button>
        </>
      )}
      {children}
    </div>
  );
}

/** Полная анкета: фото, основные сведения, «о себе», интересы. */
export function ProfileDetails({ card, onReport }: { card: ProfileCard; onReport?: () => void }) {
  const facts = [
    { icon: <MapPin className="size-4" />, text: [card.city, formatDistance(card.distanceKm)].filter(Boolean).join(" · ") },
    { icon: <Briefcase className="size-4" />, text: card.job },
    { icon: <Ruler className="size-4" />, text: card.heightCm ? `${card.heightCm} см` : "" },
  ].filter((fact) => fact.text);

  return (
    <article>
      <PhotoCarousel photos={card.photos} name={card.name} className="aspect-[3/4] max-h-[70dvh] w-full" />

      <div className="flex flex-col gap-5 p-5">
        <header>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 className="font-display text-2xl font-bold">
              {card.name}, {card.age}
            </h2>
            {card.online && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-like">
                <span className="size-2 rounded-full bg-like" /> в сети
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {card.superLikedYou && (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-super/15 px-2.5 text-xs font-semibold text-super">
                <Star className="size-3.5 fill-current" /> Суперлайк вам
              </span>
            )}
            {card.isPremium && (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-gold/15 px-2.5 text-xs font-semibold text-gold">
                <Crown className="size-3.5" /> Premium
              </span>
            )}
            {card.isDemo && (
              <span
                className="inline-flex h-7 items-center rounded-full bg-surface-2 px-2.5 text-xs font-medium text-muted"
                title="Вымышленная анкета для демонстрации приложения"
              >
                Демо-анкета
              </span>
            )}
          </div>
        </header>

        <ul className="flex flex-col gap-2 text-[15px] text-fg/90">
          <li className="flex items-center gap-2.5">
            <span aria-hidden>{GOAL_EMOJI[card.goal]}</span>
            {GOAL_LABEL[card.goal]}
          </li>
          {facts.map((fact) => (
            <li key={fact.text} className="flex items-center gap-2.5">
              <span className="text-faint">{fact.icon}</span>
              {fact.text}
            </li>
          ))}
        </ul>

        {card.bio && (
          <section>
            <h3 className="mb-1.5 text-xs font-bold tracking-wider text-faint uppercase">О себе</h3>
            <p className="leading-relaxed whitespace-pre-line text-fg/90">{card.bio}</p>
          </section>
        )}

        {card.interests.length > 0 && (
          <section>
            <h3 className="mb-2.5 text-xs font-bold tracking-wider text-faint uppercase">
              Интересы
              {card.sharedInterests.length > 0 && (
                <span className="ml-2 text-brand normal-case">общих: {card.sharedInterests.length}</span>
              )}
            </h3>
            <div className="flex flex-wrap gap-2">
              {card.interests.map((slug) => {
                const interest = INTEREST_BY_SLUG.get(slug);
                if (!interest) return null;
                return (
                  <Tag key={slug} highlight={card.sharedInterests.includes(slug)}>
                    <span aria-hidden>{interest.emoji}</span>
                    {interest.label}
                  </Tag>
                );
              })}
            </div>
          </section>
        )}

        {onReport && (
          <button
            type="button"
            onClick={onReport}
            className="mt-2 inline-flex items-center gap-2 self-center text-sm font-medium text-faint hover:text-danger"
          >
            <Flag className="size-4" /> Пожаловаться или заблокировать
          </button>
        )}
      </div>
    </article>
  );
}

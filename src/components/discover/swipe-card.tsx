"use client";

import clsx from "clsx";
import { Briefcase, Info, MapPin, Star } from "lucide-react";
import { animate, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { useImperativeHandle, useState, type Ref } from "react";
import { Photo } from "@/components/ui/misc";
import { formatDistance } from "@/lib/shared/geo";
import { INTEREST_BY_SLUG } from "@/lib/shared/interests";
import type { ProfileCard, SwipeAction } from "@/lib/shared/types";

export type SwipeCardHandle = { fling: (action: SwipeAction) => void };

const SWIPE_DISTANCE = 110;
const SWIPE_VELOCITY = 650;

/**
 * Карточка анкеты в стопке. Верхнюю можно тянуть: вправо — лайк, влево — пропустить,
 * вверх — суперлайк. Те же действия доступны кнопками через ref.fling().
 */
export function SwipeCard({
  card,
  depth,
  onSwiped,
  onOpen,
  ref,
}: {
  card: ProfileCard;
  /** 0 — верхняя карточка, 1 и 2 — выглядывают из-под неё */
  depth: number;
  onSwiped: (action: SwipeAction) => void;
  onOpen: () => void;
  ref?: Ref<SwipeCardHandle>;
}) {
  const active = depth === 0;
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-320, 320], [-16, 16]);
  const likeOpacity = useTransform(x, [30, 130], [0, 1]);
  const nopeOpacity = useTransform(x, [-130, -30], [1, 0]);
  const superOpacity = useTransform(y, [-150, -50], [1, 0]);

  const [photoIndex, setPhotoIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);

  function fling(action: SwipeAction) {
    if (leaving) return;
    setLeaving(true);
    const options = { duration: 0.28, ease: "easeOut" } as const;
    const done = () => onSwiped(action);
    if (action === "superlike") animate(y, -900, options).then(done);
    else animate(x, action === "like" ? 700 : -700, options).then(done);
  }

  useImperativeHandle(ref, () => ({ fling }));

  function onDragEnd(_: unknown, info: PanInfo) {
    const { offset, velocity } = info;
    // Вертикальный жест считаем суперлайком, только если он явно преобладает
    if (offset.y < -SWIPE_DISTANCE * 1.2 && Math.abs(offset.x) < SWIPE_DISTANCE) return fling("superlike");
    if (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY) return fling("like");
    if (offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_VELOCITY) return fling("pass");
    const spring = { type: "spring", stiffness: 420, damping: 32 } as const;
    animate(x, 0, spring);
    animate(y, 0, spring);
  }

  function onTap(event: MouseEvent | TouchEvent | PointerEvent) {
    const target = event.currentTarget as HTMLElement | null;
    const point = "clientX" in event ? event.clientX : event.changedTouches[0]?.clientX;
    if (!target || point === undefined || card.photos.length < 2) return;
    const rect = target.getBoundingClientRect();
    const ratio = (point - rect.left) / rect.width;
    if (ratio < 0.35) setPhotoIndex((i) => Math.max(0, i - 1));
    else if (ratio > 0.65) setPhotoIndex((i) => Math.min(card.photos.length - 1, i + 1));
  }

  const chips = (card.sharedInterests.length ? card.sharedInterests : card.interests).slice(0, 3);

  return (
    <motion.div
      className={clsx(
        "absolute inset-0 touch-none overflow-hidden rounded-card bg-surface-2 shadow-2xl ring-1 ring-white/10 select-none",
        active ? "cursor-grab active:cursor-grabbing" : "pointer-events-none",
      )}
      style={{ x, y, rotate, zIndex: 10 - depth }}
      initial={false}
      animate={{ scale: 1 - depth * 0.045, translateY: depth * 14, opacity: depth > 2 ? 0 : 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      drag={active && !leaving}
      dragElastic={0.85}
      dragMomentum={false}
      onDragEnd={onDragEnd}
      onTap={active ? onTap : undefined}
      aria-hidden={!active}
    >
      <Photo
        photo={card.photos[photoIndex] ?? card.photos[0]}
        alt={`${card.name}, ${card.age}`}
        className="pointer-events-none size-full"
        eager={depth < 2}
        priority={active}
      />

      {card.photos.length > 1 && (
        <div className="absolute inset-x-3 top-3 flex gap-1.5">
          {card.photos.map((photo, i) => (
            <span
              key={photo.id}
              className={clsx("h-1 flex-1 rounded-full", i === photoIndex ? "bg-white" : "bg-white/35")}
            />
          ))}
        </div>
      )}

      {card.superLikedYou && (
        <span className="absolute top-7 left-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-super px-3 text-xs font-bold text-black shadow-lg">
          <Star className="size-3.5 fill-current" /> Вы понравились
        </span>
      )}

      {/* Штампы, проявляющиеся при перетаскивании */}
      <motion.span
        style={{ opacity: likeOpacity }}
        className="absolute top-12 left-5 -rotate-12 rounded-xl border-4 border-like px-3 py-1 font-display text-2xl font-bold text-like"
      >
        НРАВИТСЯ
      </motion.span>
      <motion.span
        style={{ opacity: nopeOpacity }}
        className="absolute top-12 right-5 rotate-12 rounded-xl border-4 border-nope px-3 py-1 font-display text-2xl font-bold text-nope"
      >
        НЕТ
      </motion.span>
      <motion.span
        style={{ opacity: superOpacity }}
        className="absolute bottom-40 left-1/2 -translate-x-1/2 rounded-xl border-4 border-super px-3 py-1 font-display text-2xl font-bold text-super"
      >
        СУПЕР
      </motion.span>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-5 pt-24 pb-5">
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2.5 font-display text-[26px] leading-tight font-bold">
              <span className="truncate">
                {card.name}, {card.age}
              </span>
              {card.online && <span className="size-2.5 shrink-0 rounded-full bg-like" title="В сети" />}
            </h2>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-white/85">
              <MapPin className="size-4 shrink-0" />
              <span className="truncate">{[card.city, formatDistance(card.distanceKm)].filter(Boolean).join(" · ")}</span>
            </p>
            {card.job && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-white/85">
                <Briefcase className="size-4 shrink-0" />
                <span className="truncate">{card.job}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onOpen}
            onPointerDownCapture={(e) => e.stopPropagation()}
            aria-label={`Открыть анкету: ${card.name}`}
            className="pointer-events-auto flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/30"
          >
            <Info className="size-5" />
          </button>
        </div>

        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {chips.map((slug) => {
              const interest = INTEREST_BY_SLUG.get(slug);
              if (!interest) return null;
              const shared = card.sharedInterests.includes(slug);
              return (
                <span
                  key={slug}
                  className={clsx(
                    "inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-semibold backdrop-blur",
                    shared ? "bg-brand/85 text-white" : "bg-white/15 text-white/90",
                  )}
                >
                  <span aria-hidden>{interest.emoji}</span>
                  {interest.label}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

"use client";

import { MessageCircle } from "lucide-react";
import { useEffect } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Photo } from "@/components/ui/misc";
import type { PhotoDto, SwipeResult } from "@/lib/shared/types";

const SPARKS = [
  { left: "12%", top: "18%", delay: "0s", size: "2.2rem" },
  { left: "82%", top: "14%", delay: "0.15s", size: "1.6rem" },
  { left: "70%", top: "64%", delay: "0.3s", size: "2rem" },
  { left: "18%", top: "70%", delay: "0.2s", size: "1.4rem" },
  { left: "48%", top: "8%", delay: "0.35s", size: "1.2rem" },
  { left: "90%", top: "42%", delay: "0.1s", size: "1.3rem" },
];

/** Полноэкранное «Это взаимно!» после совпадения симпатий. */
export function MatchModal({
  match,
  myPhoto,
  onClose,
}: {
  match: NonNullable<SwipeResult["match"]> | null;
  myPhoto: PhotoDto | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!match) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [match, onClose]);

  if (!match) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Взаимная симпатия"
      className="fixed inset-0 z-[60] flex animate-fade-in flex-col items-center justify-center overflow-hidden bg-bg/95 px-6 text-center backdrop-blur-xl"
    >
      <div className="pointer-events-none absolute -top-32 left-1/2 size-[34rem] -translate-x-1/2 rounded-full bg-spark opacity-30 blur-[110px]" aria-hidden />
      {SPARKS.map((spark, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute animate-pop"
          style={{ left: spark.left, top: spark.top, fontSize: spark.size, animationDelay: spark.delay }}
        >
          ✨
        </span>
      ))}

      <div className="relative flex items-center justify-center">
        <Photo
          photo={myPhoto}
          alt="Вы"
          className="size-32 -rotate-6 animate-pop rounded-[2rem] ring-4 ring-bg sm:size-40"
        />
        <Photo
          photo={match.user.photo}
          alt={match.user.name}
          className="-ml-6 size-32 rotate-6 animate-pop rounded-[2rem] ring-4 ring-bg [animation-delay:120ms] sm:size-40"
        />
        <span className="absolute -bottom-4 flex size-14 animate-pop items-center justify-center rounded-full bg-spark text-2xl shadow-xl [animation-delay:260ms]">
          💛
        </span>
      </div>

      <h2 className="relative mt-12 animate-slide-up text-spark font-display text-4xl font-bold sm:text-5xl">
        Это взаимно!
      </h2>
      <p className="relative mt-3 max-w-xs animate-slide-up text-muted">
        Вы и {match.user.name} понравились друг другу. Самое время написать.
      </p>

      <div className="relative mt-9 flex w-full max-w-xs animate-slide-up flex-col gap-2.5">
        <LinkButton href={`/chat/${match.id}`} size="lg" block onClick={onClose}>
          <MessageCircle className="size-5" /> Написать сообщение
        </LinkButton>
        <Button variant="ghost" size="lg" block onClick={onClose}>
          Продолжить смотреть
        </Button>
      </div>
    </div>
  );
}

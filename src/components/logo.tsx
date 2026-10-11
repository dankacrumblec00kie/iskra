import clsx from "clsx";
import { useId } from "react";

/** Знак: искра — четырёхлучевая звезда в фирменном градиенте. */
export function LogoMark({ className }: { className?: string }) {
  // id градиента должен быть уникальным: на странице бывает два логотипа, и если первый
  // скрыт через display:none, второй, ссылаясь на тот же id, остаётся без заливки
  const gradientId = useId();
  return (
    <svg viewBox="0 0 32 32" className={className ?? "size-8"} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff8a3d" />
          <stop offset="0.5" stopColor="#ff4d6d" />
          <stop offset="1" stopColor="#b44dff" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradientId})`}
        d="M16 1.5Q17.8 14.2 30.5 16Q17.8 17.8 16 30.5Q14.2 17.8 1.5 16Q14.2 14.2 16 1.5Z"
      />
      <circle cx="25.5" cy="6.5" r="2" fill="#ff8a3d" />
    </svg>
  );
}

export function Logo({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span className={clsx("inline-flex items-center gap-2 font-display font-bold tracking-tight", className)}>
      <LogoMark className={size === "lg" ? "size-10" : size === "sm" ? "size-6" : "size-8"} />
      <span className={size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-xl"}>Искра</span>
    </span>
  );
}

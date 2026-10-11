import clsx from "clsx";
import { LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { PhotoDto } from "@/lib/shared/types";

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={clsx("animate-spin", className ?? "size-5")} aria-hidden />;
}

/** Полноэкранная загрузка (fallback для Suspense и первой загрузки экрана). */
export function ScreenLoader({ label = "Загрузка…" }: { label?: string }) {
  return (
    <div className="flex min-h-[60dvh] flex-1 flex-col items-center justify-center gap-3 text-muted" role="status">
      <Spinner className="size-7 text-brand" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton rounded-2xl", className)} aria-hidden />;
}

export function EmptyState({
  emoji,
  title,
  text,
  children,
}: {
  emoji: string;
  title: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-14 text-center animate-fade-in">
      <div className="text-5xl" aria-hidden>
        {emoji}
      </div>
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {text && <p className="max-w-xs text-sm leading-relaxed text-muted">{text}</p>}
      {children && <div className="mt-2 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

/** Состояние ошибки с кнопкой повтора — используется на каждом экране с данными. */
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-14 text-center" role="alert">
      <TriangleAlert className="size-9 text-danger" aria-hidden />
      <h2 className="font-display text-lg font-bold">Не получилось загрузить</h2>
      <p className="max-w-xs text-sm text-muted">{message ?? "Проверьте соединение и попробуйте ещё раз"}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex h-10 items-center gap-2 rounded-full bg-surface-2 px-5 text-sm font-semibold hover:bg-surface-3"
        >
          <RefreshCw className="size-4" /> Повторить
        </button>
      )}
    </div>
  );
}

/** Фото с размытым превью в качестве фона, пока грузится основное изображение. */
export function Photo({
  photo,
  alt,
  className,
  eager,
  priority,
}: {
  photo: PhotoDto | null | undefined;
  alt: string;
  className?: string;
  eager?: boolean;
  /** Главное изображение экрана: браузер загрузит его раньше остальных */
  priority?: boolean;
}) {
  if (!photo) {
    return (
      <div className={clsx("flex items-center justify-center bg-surface-3 text-2xl text-faint", className)} aria-label={alt}>
        👤
      </div>
    );
  }
  return (
    // Фото уже сжаты на сервере в WebP нужного размера, оптимизатор next/image не нужен
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo.url}
      alt={alt}
      width={photo.width}
      height={photo.height}
      loading={eager || priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      draggable={false}
      className={clsx("bg-cover bg-center object-cover", className)}
      style={photo.blur ? { backgroundImage: `url(${photo.blur})` } : undefined}
    />
  );
}

export function Avatar({
  photo,
  name,
  size = 48,
  online,
  className,
}: {
  photo: PhotoDto | null | undefined;
  name: string;
  size?: number;
  online?: boolean;
  className?: string;
}) {
  return (
    <span className={clsx("relative inline-block shrink-0", className)} style={{ width: size, height: size }}>
      <Photo photo={photo} alt={name} className="size-full rounded-full" />
      {online && (
        <span
          className="absolute right-0 bottom-0 size-3.5 rounded-full border-2 border-bg bg-like"
          title="В сети"
          aria-label="В сети"
        />
      )}
    </span>
  );
}

export function Chip({
  active,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={clsx(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition active:scale-95",
        active
          ? "border-transparent bg-spark text-white"
          : "border-line bg-surface text-muted hover:border-white/25 hover:text-fg",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Некликабельная метка (интересы в анкете, статусы). */
export function Tag({ highlight, children }: { highlight?: boolean; children: ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium",
        highlight ? "bg-brand-soft text-brand ring-1 ring-brand/40" : "bg-surface-2 text-fg/85",
      )}
    >
      {children}
    </span>
  );
}

export function Badge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={clsx(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50",
        checked ? "bg-brand" : "bg-surface-3",
      )}
    >
      <span
        className={clsx(
          "absolute top-1 left-1 size-5 rounded-full bg-white transition-transform",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}

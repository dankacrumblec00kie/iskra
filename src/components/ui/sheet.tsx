"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Модальное окно: на телефоне выезжает снизу, на десктопе — по центру.
 * Закрывается по Esc и клику на фон, блокирует прокрутку страницы под собой.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  bare,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Без шапки и отступов — содержимое само управляет вёрсткой */
  bare?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <div className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={clsx(
          "relative flex max-h-[92dvh] w-full animate-slide-up flex-col overflow-hidden rounded-t-[2rem] bg-surface shadow-2xl outline-none",
          "md:rounded-[2rem] md:ring-1 md:ring-line",
          size === "sm" && "md:max-w-sm",
          size === "md" && "md:max-w-md",
          size === "lg" && "md:max-w-2xl",
        )}
      >
        {!bare && (
          <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
            <h2 className="font-display text-lg font-bold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-muted hover:text-fg"
            >
              <X className="size-5" />
            </button>
          </header>
        )}
        <div className={clsx("flex-1 overflow-y-auto", !bare && "px-5 pb-5")}>{children}</div>
        {footer && <footer className="border-t border-line px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{footer}</footer>}
      </div>
    </div>
  );
}

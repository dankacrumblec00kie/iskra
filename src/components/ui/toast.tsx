"use client";

import clsx from "clsx";
import { createContext, use, useCallback, useRef, useState, type ReactNode } from "react";

type ToastKind = "info" | "success" | "error";
type ToastItem = { id: number; message: string; kind: ToastKind };

const ToastContext = createContext<((message: string, kind?: ToastKind) => void) | null>(null);

/** Всплывающие сообщения: toast("Сохранено", "success"). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = nextId.current++;
    setItems((list) => [...list.slice(-2), { id, message, kind }]);
    setTimeout(() => setItems((list) => list.filter((item) => item.id !== id)), 3800);
  }, []);

  return (
    <ToastContext value={toast}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] flex flex-col items-center gap-2 px-4 lg:bottom-8"
        aria-live="polite"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={clsx(
              "pointer-events-auto max-w-sm animate-slide-up rounded-2xl px-4 py-3 text-sm font-medium shadow-2xl",
              item.kind === "error" && "bg-danger text-white",
              item.kind === "success" && "bg-like text-black",
              item.kind === "info" && "bg-surface-3 text-fg ring-1 ring-line",
            )}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast() {
  const toast = use(ToastContext);
  if (!toast) throw new Error("useToast используется вне ToastProvider");
  return toast;
}

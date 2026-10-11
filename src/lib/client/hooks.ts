"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import type { Counters, Me } from "@/lib/shared/types";
import { ApiRequestError, fetcher } from "./api";

export const KEYS = {
  me: "/api/me",
  counters: "/api/me/counters",
  config: "/api/config",
  matches: "/api/matches",
  likes: "/api/likes",
  notifications: "/api/notifications",
} as const;

/** Текущий пользователь. 401 не повторяем — AppShell отправит на страницу входа. */
export function useMe() {
  return useSWR<Me, ApiRequestError>(KEYS.me, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: (error) => error.status !== 401 && error.status !== 403,
  });
}

/** Счётчики для бейджей: опрашиваются раз в 15 секунд, пока вкладка активна. */
export function useCounters(enabled = true) {
  return useSWR<Counters>(enabled ? KEYS.counters : null, fetcher, {
    refreshInterval: 15_000,
    dedupingInterval: 5_000,
  });
}

export type AppConfig = {
  demoMode: boolean;
  googleAuth: boolean;
  paymentProvider: "demo" | "yookassa";
  vapidPublicKey: string | null;
};

export function useConfig() {
  return useSWR<AppConfig>(KEYS.config, fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
  });
}

/** Значение, которое обновляется не чаще, чем раз в `delay` мс (для поиска по мере ввода). */
export function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

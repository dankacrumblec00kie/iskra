"use client";

import { useSyncExternalStore } from "react";
import type { Goal } from "@/lib/shared/constants";

/**
 * Фильтры «на сейчас» (цель, интересы, только онлайн). Общие для ленты и экрана «Рядом»,
 * живут до перезагрузки страницы. Возраст и расстояние — постоянные настройки,
 * они сохраняются в профиле на сервере.
 */
export type SessionFilters = { goal: Goal | null; interests: string[]; online: boolean };

const initial: SessionFilters = { goal: null, interests: [], online: false };
let state = initial;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSessionFilters(next: SessionFilters) {
  state = next;
  listeners.forEach((listener) => listener());
}

export function useSessionFilters() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => initial,
  );
}

/**
 * Версия постоянных настроек поиска (пол, возраст, расстояние, город). Входит в ключи SWR
 * ленты и «Рядом»: после сохранения настроек версия растёт, и списки загружаются заново.
 * Благодаря этому списки не ждут ответа /api/me и запрашиваются параллельно с ним.
 */
let searchVersion = 0;

export function bumpSearchVersion() {
  searchVersion += 1;
  listeners.forEach((listener) => listener());
}

export function useSearchVersion() {
  return useSyncExternalStore(
    subscribe,
    () => searchVersion,
    () => 0,
  );
}

export const countActive =(f: SessionFilters) => (f.goal ? 1 : 0) + (f.online ? 1 : 0) + f.interests.length;

/** Query-строка для /api/discover и /api/nearby. */
export function filtersQuery(f: SessionFilters, extra: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams();
  if (f.goal) params.set("goal", f.goal);
  if (f.online) params.set("online", "1");
  if (f.interests.length) params.set("interests", f.interests.join(","));
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

"use client";

import { LocateFixed, MapPin } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { Field, Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/misc";
import { api, errorMessage, fetcher } from "@/lib/client/api";
import { useDebounced } from "@/lib/client/hooks";
import type { GeoPlace } from "@/lib/shared/types";

export type CityValue = { city: string; lat: number; lng: number };

/**
 * Выбор города: подсказки по мере ввода (внешний API геокодинга через наш сервер)
 * или определение по геолокации браузера.
 */
export function CityPicker({
  value,
  onChange,
  error,
}: {
  value: CityValue | null;
  onChange: (value: CityValue | null) => void;
  error?: string;
}) {
  const [query, setQuery] = useState(value?.city ?? "");
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");

  const debounced = useDebounced(query.trim());
  const shouldSearch = open && debounced.length >= 2 && debounced !== value?.city;
  const {
    data,
    error: searchError,
    isLoading,
  } = useSWR<{ places: GeoPlace[] }>(
    shouldSearch ? `/api/geo/search?q=${encodeURIComponent(debounced)}` : null,
    fetcher,
    { keepPreviousData: true, revalidateOnFocus: false },
  );

  function select(place: GeoPlace) {
    onChange({ city: place.name, lat: place.lat, lng: place.lng });
    setQuery(place.name);
    setOpen(false);
    setLocateError("");
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      setLocateError("Браузер не поддерживает геолокацию. Введите город вручную");
      return;
    }
    setLocating(true);
    setLocateError("");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const { place } = await api<{ place: GeoPlace }>(
            `/api/geo/reverse?lat=${coords.latitude.toFixed(4)}&lng=${coords.longitude.toFixed(4)}`,
          );
          select(place);
        } catch (e) {
          setLocateError(errorMessage(e));
        }
        setLocating(false);
      },
      () => {
        setLocateError("Не удалось получить геолокацию. Разрешите доступ или введите город вручную");
        setLocating(false);
      },
      { timeout: 10_000, maximumAge: 600_000 },
    );
  }

  const places = shouldSearch ? (data?.places ?? []) : [];

  return (
    <Field label="Город" htmlFor="city" error={error || locateError}>
      <div className="relative">
        <MapPin className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-faint" />
        <Input
          id="city"
          value={query}
          placeholder="Начните вводить название"
          autoComplete="off"
          role="combobox"
          aria-expanded={shouldSearch}
          aria-controls="city-options"
          invalid={Boolean(error)}
          className="pr-12 pl-12"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            // Пока город не выбран из списка, координат нет — значение сбрасываем
            if (value) onChange(null);
          }}
        />
        {isLoading && shouldSearch && (
          <Spinner className="absolute top-1/2 right-4 size-5 -translate-y-1/2 text-faint" />
        )}

        {shouldSearch && (
          <ul
            id="city-options"
            role="listbox"
            className="absolute inset-x-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-2xl bg-surface-2 p-1.5 shadow-2xl ring-1 ring-line"
          >
            {searchError && <li className="px-3 py-3 text-sm text-danger">{errorMessage(searchError)}</li>}
            {!searchError && !isLoading && places.length === 0 && (
              <li className="px-3 py-3 text-sm text-muted">Ничего не нашлось. Проверьте название</li>
            )}
            {places.map((place) => (
              <li key={`${place.lat},${place.lng}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => select(place)}
                  className="flex w-full flex-col rounded-xl px-3 py-2.5 text-left hover:bg-surface-3"
                >
                  <span className="text-[15px] font-medium">{place.name}</span>
                  <span className="text-xs text-muted">
                    {[place.region, place.country].filter(Boolean).join(", ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={locate}
        disabled={locating}
        className="mt-1 inline-flex w-fit items-center gap-2 text-sm font-semibold text-brand hover:underline disabled:opacity-60"
      >
        {locating ? <Spinner className="size-4" /> : <LocateFixed className="size-4" />}
        Определить автоматически
      </button>
    </Field>
  );
}

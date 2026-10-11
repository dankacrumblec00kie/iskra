import type { GeoPlace } from "@/lib/shared/types";

// Интеграция с внешними API геокодинга (ключи не нужны):
//  - Open-Meteo Geocoding — поиск города по названию;
//  - Nominatim (OpenStreetMap) — определение города по координатам.
// Запросы идут с сервера: браузер пользователя не раскрывает свой IP сторонним сервисам.

const TIMEOUT_MS = 6000;
const USER_AGENT = "iskra-dating-app/1.0 (educational project)";

async function getJson<T>(url: URL): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch (error) {
    console.error("[geo] запрос не удался:", url.hostname, (error as Error).message);
    return null;
  }
}

type OpenMeteoResult = {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
};

/** Поиск населённых пунктов по началу названия. null — внешний сервис недоступен. */
export async function searchPlaces(query: string): Promise<GeoPlace[] | null> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.search = new URLSearchParams({ name: query, count: "8", language: "ru", format: "json" }).toString();

  const data = await getJson<{ results?: OpenMeteoResult[] }>(url);
  if (!data) return null;

  return (data.results ?? []).map((r) => ({
    name: r.name,
    region: r.admin1 && r.admin1 !== r.name ? r.admin1 : "",
    country: r.country ?? "",
    lat: r.latitude,
    lng: r.longitude,
  }));
}

type NominatimResult = {
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    country?: string;
  };
};

/** Название города по координатам (для кнопки «Определить автоматически»). */
export async function reversePlace(lat: number, lng: number): Promise<GeoPlace | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.search = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: "jsonv2",
    zoom: "10",
    "accept-language": "ru",
  }).toString();

  const data = await getJson<NominatimResult>(url);
  const a = data?.address;
  const name = a?.city ?? a?.town ?? a?.village ?? a?.municipality;
  if (!a || !name) return null;

  return { name, region: a.state ?? "", country: a.country ?? "", lat, lng };
}

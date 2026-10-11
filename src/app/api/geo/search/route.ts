import { requireUser } from "@/lib/server/auth/session";
import { HttpError } from "@/lib/server/errors";
import { api } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { searchPlaces } from "@/lib/server/services/geo";

// Подсказки городов (внешний API Open-Meteo Geocoding)
export const GET = api(async (req) => {
  const user = await requireUser();
  const query = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 60);
  if (query.length < 2) return { places: [] };

  await rateLimit(`geo:${user.id}`, 60, 60);
  const places = await searchPlaces(query);
  if (!places) throw new HttpError(502, "GEO_UNAVAILABLE", "Сервис поиска городов временно недоступен");
  return { places };
});

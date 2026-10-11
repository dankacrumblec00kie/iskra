import { z } from "zod";
import { requireUser } from "@/lib/server/auth/session";
import { HttpError } from "@/lib/server/errors";
import { api, readQuery } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { reversePlace } from "@/lib/server/services/geo";

const schema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

// Город по координатам браузера (внешний API Nominatim / OpenStreetMap)
export const GET = api(async (req) => {
  const user = await requireUser();
  const { lat, lng } = readQuery(req, schema);

  await rateLimit(`geo-reverse:${user.id}`, 10, 60);
  const place = await reversePlace(lat, lng);
  if (!place) throw new HttpError(502, "GEO_UNAVAILABLE", "Не удалось определить город. Введите его вручную");
  return { place };
});

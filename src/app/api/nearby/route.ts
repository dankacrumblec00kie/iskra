import { requireUser } from "@/lib/server/auth/session";
import { api, readQuery } from "@/lib/server/http";
import { getViewer } from "@/lib/server/services/cards";
import { getNearby } from "@/lib/server/services/discover";
import { searchFiltersSchema } from "@/lib/shared/validation";

// Сетка «Рядом»: поиск по тексту, фильтры, пагинация через cursor.
export const GET = api(async (req) => {
  const user = await requireUser();
  const filters = readQuery(req, searchFiltersSchema);
  return getNearby(await getViewer(user.id), filters);
});

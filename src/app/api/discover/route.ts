import { requireUser } from "@/lib/server/auth/session";
import { api, readQuery } from "@/lib/server/http";
import { getViewer } from "@/lib/server/services/cards";
import { getDeck } from "@/lib/server/services/discover";
import { searchFiltersSchema } from "@/lib/shared/validation";

// Лента для свайпов. Фильтры из query перекрывают сохранённые настройки поиска.
export const GET = api(async (req) => {
  const user = await requireUser();
  const filters = readQuery(req, searchFiltersSchema);
  return { cards: await getDeck(await getViewer(user.id), filters) };
});

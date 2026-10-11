import { z } from "zod";
import { requireAdmin } from "@/lib/server/auth/session";
import { api, readJson, uuidParam } from "@/lib/server/http";
import { resolveReport } from "@/lib/server/services/admin";

const schema = z.object({ action: z.enum(["dismiss", "ban"]) });

// Решение модератора по жалобе: отклонить или заблокировать пользователя
export const POST = api<RouteContext<"/api/admin/reports/[id]">>(async (req, ctx) => {
  await requireAdmin();
  const { action } = await readJson(req, schema);
  await resolveReport(uuidParam((await ctx.params).id), action);
  return { ok: true };
});

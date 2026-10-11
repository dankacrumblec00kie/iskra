import { requireUser } from "@/lib/server/auth/session";
import { api, uuidParam } from "@/lib/server/http";
import { unblockUser } from "@/lib/server/services/safety";

export const DELETE = api<RouteContext<"/api/blocks/[id]">>(async (_req, ctx) => {
  const user = await requireUser();
  await unblockUser(user.id, uuidParam((await ctx.params).id));
  return { ok: true };
});

import { requireUser } from "@/lib/server/auth/session";
import { api, uuidParam } from "@/lib/server/http";
import { unmatch } from "@/lib/server/services/matches";

export const DELETE = api<RouteContext<"/api/matches/[id]">>(async (_req, ctx) => {
  const user = await requireUser();
  await unmatch(uuidParam((await ctx.params).id), user.id);
  return { ok: true };
});

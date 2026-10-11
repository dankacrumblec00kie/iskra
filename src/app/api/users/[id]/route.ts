import { requireUser } from "@/lib/server/auth/session";
import { api, uuidParam } from "@/lib/server/http";
import { getPublicProfile } from "@/lib/server/services/safety";

export const GET = api<RouteContext<"/api/users/[id]">>(async (_req, ctx) => {
  const user = await requireUser();
  return getPublicProfile(user.id, uuidParam((await ctx.params).id));
});

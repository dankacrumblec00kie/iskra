import { requireUser } from "@/lib/server/auth/session";
import { api, uuidParam } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { getPublicProfile } from "@/lib/server/services/safety";

export const GET = api<RouteContext<"/api/users/[id]">>(async (_req, ctx) => {
  const user = await requireUser();
  await rateLimit(`profile-view:${user.id}`, 120, 60);
  return getPublicProfile(user.id, uuidParam((await ctx.params).id));
});

import { requireUser } from "@/lib/server/auth/session";
import { api, uuidParam } from "@/lib/server/http";
import { deletePhoto } from "@/lib/server/services/photos";

export const DELETE = api<RouteContext<"/api/me/photos/[id]">>(async (_req, ctx) => {
  const user = await requireUser();
  await deletePhoto(user.id, uuidParam((await ctx.params).id));
  return { ok: true };
});

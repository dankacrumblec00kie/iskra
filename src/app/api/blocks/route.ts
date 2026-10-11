import { requireUser } from "@/lib/server/auth/session";
import { api, readJson } from "@/lib/server/http";
import { blockUser, listBlocked } from "@/lib/server/services/safety";
import { blockSchema } from "@/lib/shared/validation";

export const GET = api(async () => ({ blocked: await listBlocked((await requireUser()).id) }));

export const POST = api(async (req) => {
  const user = await requireUser();
  const { userId } = await readJson(req, blockSchema);
  await blockUser(user.id, userId);
  return { ok: true };
});

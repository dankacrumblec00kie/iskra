import { requireUser } from "@/lib/server/auth/session";
import { api, readJson } from "@/lib/server/http";
import { reportUser } from "@/lib/server/services/safety";
import { reportSchema } from "@/lib/shared/validation";

export const POST = api(async (req) => {
  const user = await requireUser();
  const { userId, ...rest } = await readJson(req, reportSchema);
  await reportUser({ reporterId: user.id, reportedId: userId, ...rest });
  return { ok: true };
});

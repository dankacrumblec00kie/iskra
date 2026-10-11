import { createSession } from "@/lib/server/auth/session";
import { api, clientIp, readJson } from "@/lib/server/http";
import { loginUser } from "@/lib/server/services/auth";
import { loginSchema } from "@/lib/shared/validation";

export const POST = api(async (req) => {
  const input = await readJson(req, loginSchema);
  const user = await loginUser(input, clientIp(req));
  await createSession(user.id, req.headers.get("user-agent"));
  return { ok: true };
});

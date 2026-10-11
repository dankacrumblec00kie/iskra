import { destroySession } from "@/lib/server/auth/session";
import { api } from "@/lib/server/http";

export const POST = api(async () => {
  await destroySession();
  return { ok: true };
});

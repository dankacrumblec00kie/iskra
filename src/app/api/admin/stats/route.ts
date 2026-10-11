import { requireAdmin } from "@/lib/server/auth/session";
import { api } from "@/lib/server/http";
import { getAdminStats } from "@/lib/server/services/admin";

export const GET = api(async () => {
  await requireAdmin();
  return getAdminStats();
});

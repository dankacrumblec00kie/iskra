import { z } from "zod";
import { requireUser } from "@/lib/server/auth/session";
import { api, readJson } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { createCheckout } from "@/lib/server/services/billing";

// Клиент присылает только id тарифа — цена берётся на сервере из каталога.
export const POST = api(async (req) => {
  const user = await requireUser();
  const { productId } = await readJson(req, z.object({ productId: z.string().max(40) }));
  await rateLimit(`checkout:${user.id}`, 20, 3600);
  return createCheckout(user.id, productId, req.nextUrl.origin);
});

import { z } from "zod";
import { requireUser } from "@/lib/server/auth/session";
import { api, readJson } from "@/lib/server/http";
import { removeSubscription, saveSubscription } from "@/lib/server/services/push";

const subscriptionSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(300), auth: z.string().min(1).max(100) }),
});

export const POST = api(async (req) => {
  const user = await requireUser();
  await saveSubscription(user.id, await readJson(req, subscriptionSchema));
  return { ok: true };
});

export const DELETE = api(async (req) => {
  await requireUser();
  const { endpoint } = await readJson(req, z.object({ endpoint: z.url().max(1000) }));
  await removeSubscription(endpoint);
  return { ok: true };
});

import { requireUser } from "@/lib/server/auth/session";
import { api, readJson } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { rewindLastSwipe, swipe } from "@/lib/server/services/swipes";
import { swipeSchema } from "@/lib/shared/validation";

export const POST = api(async (req) => {
  const user = await requireUser();
  const { toUserId, action } = await readJson(req, swipeSchema);
  await rateLimit(`swipe:${user.id}`, 120, 60);
  return swipe(user, toUserId, action);
});

// Вернуть последнюю анкету (функция подписки)
export const DELETE = api(async () => {
  const user = await requireUser();
  return { card: await rewindLastSwipe(user) };
});

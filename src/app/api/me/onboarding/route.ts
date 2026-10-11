import { requireUser } from "@/lib/server/auth/session";
import { api, readJson } from "@/lib/server/http";
import { seedIncomingLikes } from "@/lib/server/services/demo";
import { completeOnboarding, getMe } from "@/lib/server/services/profile";
import { onboardingSchema } from "@/lib/shared/validation";

export const POST = api(async (req) => {
  const user = await requireUser();
  await completeOnboarding(user.id, await readJson(req, onboardingSchema));
  await seedIncomingLikes(user.id); // срабатывает только в демо-режиме
  return getMe(user);
});

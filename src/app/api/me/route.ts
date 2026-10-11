import { destroySession, requireUser } from "@/lib/server/auth/session";
import { api, readJson } from "@/lib/server/http";
import { deleteAccount, getMe, updateProfile } from "@/lib/server/services/profile";
import { storage } from "@/lib/server/storage";
import { profilePatchSchema } from "@/lib/shared/validation";

export const GET = api(async () => getMe(await requireUser()));

export const PATCH = api(async (req) => {
  const user = await requireUser();
  await updateProfile(user.id, await readJson(req, profilePatchSchema));
  return getMe(user);
});

export const DELETE = api(async () => {
  const user = await requireUser();
  const keys = await deleteAccount(user.id);
  await Promise.all(keys.map((key) => storage.remove(key).catch(() => {})));
  await destroySession();
  return { ok: true };
});

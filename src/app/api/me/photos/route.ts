import { requireUser } from "@/lib/server/auth/session";
import { badRequest } from "@/lib/server/errors";
import { api, readJson } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { addPhoto, reorderPhotos } from "@/lib/server/services/photos";
import { LIMITS } from "@/lib/shared/constants";
import { photoOrderSchema } from "@/lib/shared/validation";

// Загрузка фото: multipart/form-data с полем file.
export const POST = api(async (req) => {
  const user = await requireUser();
  await rateLimit(`upload:${user.id}`, 40, 3600, "Слишком много загрузок. Попробуйте позже");

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw badRequest("Файл не передан");
  if (file.size > LIMITS.maxPhotoBytes) throw badRequest("Файл больше 8 МБ", "FILE_TOO_LARGE");

  return addPhoto(user.id, Buffer.from(await file.arrayBuffer()));
});

// Новый порядок фото: { order: [id, id, ...] }
export const PUT = api(async (req) => {
  const user = await requireUser();
  const { order } = await readJson(req, photoOrderSchema);
  return { photos: await reorderPhotos(user.id, order) };
});

import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/db";
import { photos, profiles } from "@/db/schema";
import { LIMITS } from "@/lib/shared/constants";
import type { PhotoDto } from "@/lib/shared/types";
import { badRequest, conflict, notFound } from "../errors";
import { storage } from "../storage";
import { toPhotoDto } from "./cards";

const MAX_WIDTH = 1080;
const MAX_HEIGHT = 1440;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "heif", "avif"]);

/**
 * Приводит загруженный файл к единому виду: WebP не больше 1080×1440.
 * Формат определяем по содержимому, а не по расширению или MIME от клиента.
 * sharp по умолчанию не переносит метаданные, поэтому EXIF с геометкой
 * и моделью телефона в итоговый файл не попадает.
 */
export async function processImage(input: Buffer) {
  let image: ReturnType<typeof sharp>;
  let format: string | undefined;
  try {
    image = sharp(input, { failOn: "error", limitInputPixels: 50_000_000 });
    format = (await image.metadata()).format;
  } catch {
    throw badRequest("Не удалось прочитать изображение", "BAD_IMAGE");
  }
  if (!format || !ALLOWED_FORMATS.has(format)) {
    throw badRequest("Поддерживаются JPEG, PNG, WebP и HEIC", "BAD_IMAGE");
  }

  const main = await image
    .rotate() // поворот по EXIF до того, как метаданные будут отброшены
    .resize(MAX_WIDTH, MAX_HEIGHT, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  if (main.info.width < 200 || main.info.height < 200) {
    throw badRequest("Фото слишком маленькое — минимум 200×200", "BAD_IMAGE");
  }

  const blur = await sharp(main.data).resize(24).blur(2).webp({ quality: 40 }).toBuffer();

  return {
    data: main.data,
    width: main.info.width,
    height: main.info.height,
    blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`,
  };
}

export async function addPhoto(userId: string, file: Buffer): Promise<PhotoDto> {
  if (file.byteLength > LIMITS.maxPhotoBytes) {
    throw badRequest("Файл больше 8 МБ", "FILE_TOO_LARGE");
  }

  const [{ count, maxPosition }] = await db
    .select({
      count: sql<number>`count(*)::int`,
      maxPosition: sql<number>`coalesce(max(${photos.position}), -1)::int`,
    })
    .from(photos)
    .where(eq(photos.userId, userId));
  if (count >= LIMITS.maxPhotos) {
    throw conflict(`Можно загрузить до ${LIMITS.maxPhotos} фото`, "PHOTO_LIMIT");
  }

  const processed = await processImage(file);
  const storageKey = `photos/${userId}/${randomUUID()}.webp`;
  const { url } = await storage.put(storageKey, processed.data, "image/webp");

  const [row] = await db
    .insert(photos)
    .values({
      userId,
      url,
      storageKey,
      width: processed.width,
      height: processed.height,
      blurDataUrl: processed.blurDataUrl,
      position: maxPosition + 1,
    })
    .returning();

  return toPhotoDto(row);
}

export async function deletePhoto(userId: string, photoId: string) {
  const [photo] = await db
    .select()
    .from(photos)
    .where(and(eq(photos.id, photoId), eq(photos.userId, userId)))
    .limit(1);
  if (!photo) throw notFound("Фото не найдено");

  const [[{ count }], [profile]] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(photos).where(eq(photos.userId, userId)),
    db
      .select({ onboardedAt: profiles.onboardedAt })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1),
  ]);
  if (profile?.onboardedAt && count <= 1) {
    throw conflict("В анкете должно остаться хотя бы одно фото", "LAST_PHOTO");
  }

  await db.delete(photos).where(eq(photos.id, photoId));
  await storage.remove(photo.storageKey).catch((e) => console.error("[storage] remove:", e));
}

/** Сохраняет новый порядок фотографий; первая становится главной. */
export async function reorderPhotos(userId: string, order: string[]): Promise<PhotoDto[]> {
  const mine = await db.select({ id: photos.id }).from(photos).where(eq(photos.userId, userId));
  const mineIds = new Set(mine.map((p) => p.id));
  const valid =
    order.length === mineIds.size &&
    new Set(order).size === order.length &&
    order.every((id) => mineIds.has(id));
  if (!valid) throw badRequest("Список фото не совпадает с загруженными");

  await db.transaction(async (tx) => {
    for (const [position, id] of order.entries()) {
      await tx.update(photos).set({ position }).where(eq(photos.id, id));
    }
  });

  const rows = await db
    .select()
    .from(photos)
    .where(eq(photos.userId, userId))
    .orderBy(asc(photos.position));
  return rows.map(toPhotoDto);
}

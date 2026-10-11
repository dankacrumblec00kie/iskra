import fs from "node:fs/promises";
import path from "node:path";

/**
 * Хранилище файлов с двумя реализациями:
 *  - local — папка ./uploads, файлы раздаёт /api/files/* (разработка, свой сервер);
 *  - blob  — Vercel Blob (на Vercel файловая система только для чтения).
 * Выбор — переменной STORAGE_DRIVER; остальной код о реализации не знает.
 */
export interface Storage {
  put(key: string, data: Buffer, contentType: string): Promise<{ url: string }>;
  remove(key: string): Promise<void>;
}

export const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

/** Превращает ключ в путь внутри UPLOADS_DIR; ключи с выходом из папки отклоняет. */
export function resolveUploadPath(key: string) {
  // На Linux обратный слэш — обычный символ имени, поэтому такие ключи отклоняем явно
  if (key.includes("\\") || key.includes("\0")) return null;
  const full = path.resolve(UPLOADS_DIR, key);
  if (!full.startsWith(UPLOADS_DIR + path.sep)) return null;
  return full;
}

const localStorage: Storage = {
  async put(key, data) {
    const full = resolveUploadPath(key);
    if (!full) throw new Error("Недопустимый ключ файла");
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    return { url: `/api/files/${key}` };
  },
  async remove(key) {
    const full = resolveUploadPath(key);
    if (full) await fs.rm(full, { force: true });
  },
};

const blobStorage: Storage = {
  async put(key, data, contentType) {
    const { put } = await import("@vercel/blob");
    // Ключи уже уникальны (UUID); перезапись нужна только сиду, который пересоздаёт демо-фото
    const blob = await put(key, data, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return { url: blob.url };
  },
  async remove(key) {
    const { del } = await import("@vercel/blob");
    await del(key);
  },
};

export const storage: Storage = process.env.STORAGE_DRIVER === "blob" ? blobStorage : localStorage;

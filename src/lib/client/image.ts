const MAX_SIDE = 1600;
const SKIP_BELOW_BYTES = 1_200_000;

/**
 * Уменьшает фото в браузере перед отправкой: снимок с телефона на 8–12 МБ
 * превращается в ~300–600 КБ. Загрузка быстрее на мобильной сети, а запрос
 * укладывается в лимит размера тела у serverless-функций.
 * Если браузер не смог прочитать файл (например, HEIC), отправляем как есть —
 * формат проверит и сконвертирует сервер.
 */
export async function prepareImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < SKIP_BELOW_BYTES) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    return blob ?? file;
  } catch {
    return file;
  }
}

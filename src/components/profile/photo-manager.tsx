"use client";

import clsx from "clsx";
import { Plus, Star, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Photo, Spinner } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client/api";
import { prepareImage } from "@/lib/client/image";
import { LIMITS } from "@/lib/shared/constants";
import type { PhotoDto } from "@/lib/shared/types";

/**
 * Сетка фотографий анкеты: загрузка, удаление, выбор главного фото.
 * Каждое действие сразу сохраняется на сервере; родитель получает актуальный список.
 */
export function PhotoManager({
  photos,
  onChange,
}: {
  photos: PhotoDto[];
  onChange: (photos: PhotoDto[]) => void;
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  const freeSlots = LIMITS.maxPhotos - photos.length - uploading;

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const selected = [...files].slice(0, Math.max(0, freeSlots));
    if (selected.length < files.length) {
      toast(`Можно загрузить до ${LIMITS.maxPhotos} фото`, "info");
    }

    let current = photos;
    setUploading(selected.length);
    for (const file of selected) {
      try {
        const form = new FormData();
        form.append("file", await prepareImage(file), "photo.jpg");
        const photo = await api<PhotoDto>("/api/me/photos", { method: "POST", body: form });
        current = [...current, photo];
        onChange(current);
      } catch (error) {
        toast(errorMessage(error), "error");
      }
      setUploading((n) => n - 1);
    }
    setUploading(0);
    if (input.current) input.current.value = "";
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await api(`/api/me/photos/${id}`, { method: "DELETE" });
      onChange(photos.filter((p) => p.id !== id));
    } catch (error) {
      toast(errorMessage(error), "error");
    }
    setBusyId(null);
  }

  async function makeMain(id: string) {
    setBusyId(id);
    try {
      const order = [id, ...photos.filter((p) => p.id !== id).map((p) => p.id)];
      const result = await api<{ photos: PhotoDto[] }>("/api/me/photos", { method: "PUT", body: { order } });
      onChange(result.photos);
    } catch (error) {
      toast(errorMessage(error), "error");
    }
    setBusyId(null);
  }

  const slots = Array.from({ length: LIMITS.maxPhotos }, (_, i) => photos[i] ?? null);
  let pendingLeft = uploading;

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        hidden
        onChange={(e) => upload(e.target.files)}
      />
      <div className="grid grid-cols-3 gap-2.5">
        {slots.map((photo, index) => {
          if (photo) {
            const busy = busyId === photo.id;
            return (
              <div key={photo.id} className="group relative aspect-[3/4] overflow-hidden rounded-2xl bg-surface-2">
                <Photo photo={photo} alt={`Фото ${index + 1}`} className={clsx("size-full", busy && "opacity-40")} />
                {index === 0 ? (
                  <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold backdrop-blur">
                    Главное
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => makeMain(photo.id)}
                    disabled={busy}
                    aria-label="Сделать главным"
                    title="Сделать главным"
                    className="absolute top-2 left-2 flex size-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
                  >
                    <Star className="size-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(photo.id)}
                  disabled={busy}
                  aria-label="Удалить фото"
                  title="Удалить фото"
                  className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-danger"
                >
                  <Trash2 className="size-4" />
                </button>
                {busy && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Spinner />
                  </span>
                )}
              </div>
            );
          }

          if (pendingLeft > 0) {
            pendingLeft -= 1;
            return (
              <div key={`pending-${index}`} className="skeleton flex aspect-[3/4] items-center justify-center rounded-2xl">
                <Spinner className="size-6 text-muted" />
              </div>
            );
          }

          return (
            <button
              key={`empty-${index}`}
              type="button"
              onClick={() => input.current?.click()}
              disabled={uploading > 0}
              aria-label="Добавить фото"
              className="flex aspect-[3/4] items-center justify-center rounded-2xl border-2 border-dashed border-line text-faint transition hover:border-brand hover:text-brand disabled:opacity-50"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-surface-2">
                <Plus className="size-5" />
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-faint">
        До {LIMITS.maxPhotos} фото. Первое — главное, его видят в ленте. JPEG, PNG, WebP или HEIC.
      </p>
    </div>
  );
}

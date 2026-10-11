import type { ApiError } from "@/lib/shared/types";

/** Ошибка API с кодом и сообщениями по полям формы. */
export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

type Options = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Объект уйдёт как JSON, FormData — как multipart (загрузка файлов) */
  body?: unknown;
  signal?: AbortSignal;
};

/**
 * Единственная точка обращения к API из интерфейса.
 * Любой неуспешный ответ превращается в ApiRequestError с текстом для пользователя.
 */
export async function api<T>(path: string, { method = "GET", body, signal }: Options = {}): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      signal,
      credentials: "same-origin",
      headers: body !== undefined && !isForm ? { "content-type": "application/json" } : undefined,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiRequestError(0, "NETWORK", "Нет связи с сервером. Проверьте интернет");
  }

  const data = (await response.json().catch(() => null)) as T | ApiError | null;

  if (!response.ok) {
    const error = (data as ApiError | null)?.error;
    throw new ApiRequestError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? "Что-то пошло не так. Попробуйте ещё раз",
      error?.fields,
    );
  }
  return data as T;
}

/** fetcher для SWR: ключ — это путь API. */
export const fetcher = <T>(path: string) => api<T>(path);

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Что-то пошло не так";
}

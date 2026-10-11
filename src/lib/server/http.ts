import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { badRequest, forbidden, HttpError, notFound, validationError } from "./errors";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

type Handler<C> = (req: NextRequest, ctx: C) => Promise<unknown>;

/**
 * Обёртка для Route Handlers: единый формат ошибок, защита от CSRF
 * и автоматическая сериализация результата в JSON.
 *
 * Формат ошибки: { error: { code, message, fields? } }
 */
export function api<C = unknown>(handler: Handler<C>, options: { csrf?: boolean } = {}) {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    try {
      if (options.csrf !== false && !SAFE_METHODS.has(req.method)) assertSameOrigin(req);
      const result = await handler(req, ctx);
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

/**
 * Изменяющие запросы принимаем только со своего origin. Cookie сессии уже
 * SameSite=Lax, это второй рубеж. Запросы без заголовка Origin (curl, серверы)
 * пропускаем: CSRF возможен только из браузера жертвы, а браузер Origin шлёт.
 */
function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw forbidden("Запрос с недопустимого источника", "BAD_ORIGIN");
  }
  if (originHost !== host) throw forbidden("Запрос с недопустимого источника", "BAD_ORIGIN");
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof ZodError) error = zodToHttpError(error);

  if (error instanceof HttpError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, fields: error.fields } },
      { status: error.status },
    );
  }

  // Неожиданная ошибка: детали — только в лог сервера, клиенту — общий текст
  console.error("[api] необработанная ошибка:", error);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Что-то пошло не так. Попробуйте ещё раз" } },
    { status: 500 },
  );
}

export function zodToHttpError(error: ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!(key in fields)) fields[key] = issue.message;
  }
  return validationError(fields, Object.values(fields)[0]);
}

/** Читает JSON-тело и валидирует его схемой. */
export async function readJson<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest("Ожидается JSON в теле запроса");
  }
  return schema.parse(body);
}

/** Валидирует query-параметры схемой. Повторяющиеся ключи собираются в массив. */
export function readQuery<T>(req: NextRequest, schema: ZodType<T>): T {
  const raw: Record<string, string | string[]> = {};
  for (const key of new Set(req.nextUrl.searchParams.keys())) {
    const values = req.nextUrl.searchParams.getAll(key);
    raw[key] = values.length > 1 ? values : values[0];
  }
  return schema.parse(raw);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Проверяет id из адреса. Не-UUID — это 404, а не ошибка базы данных. */
export function uuidParam(value: string) {
  if (!UUID_RE.test(value)) throw notFound();
  return value;
}

export function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

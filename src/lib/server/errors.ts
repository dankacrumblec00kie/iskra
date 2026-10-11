/** Ошибка с HTTP-статусом и машинным кодом — её ловит обёртка api() и превращает в JSON-ответ. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (message = "Некорректный запрос", code = "BAD_REQUEST") =>
  new HttpError(400, code, message);

export const unauthorized = (message = "Войдите в аккаунт") =>
  new HttpError(401, "UNAUTHORIZED", message);

export const forbidden = (message = "Недостаточно прав", code = "FORBIDDEN") =>
  new HttpError(403, code, message);

export const notFound = (message = "Не найдено") => new HttpError(404, "NOT_FOUND", message);

export const conflict = (message: string, code = "CONFLICT") => new HttpError(409, code, message);

export const validationError = (fields: Record<string, string>, message = "Проверьте поля формы") =>
  new HttpError(422, "VALIDATION", message, fields);

export const tooManyRequests = (message = "Слишком много попыток. Попробуйте позже") =>
  new HttpError(429, "RATE_LIMITED", message);

/** Действие доступно только с подпиской или упёрлось в бесплатный лимит. */
export const paymentRequired = (message: string, code = "PREMIUM_REQUIRED") =>
  new HttpError(402, code, message);

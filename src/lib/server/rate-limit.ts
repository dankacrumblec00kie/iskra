import { lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";
import { tooManyRequests } from "./errors";

/**
 * Ограничение частоты «фиксированным окном». Счётчик лежит в PostgreSQL:
 * на serverless у каждого инстанса своя память, общий только диск базы.
 *
 * @param key     что ограничиваем, например `login:1.2.3.4`
 * @param limit   сколько запросов разрешено за окно
 * @param windowSeconds длина окна
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number, message?: string) {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });

  // Изредка подчищаем устаревшие окна, чтобы таблица не росла
  if (Math.random() < 0.02) {
    await db
      .delete(rateLimits)
      .where(lt(rateLimits.windowStart, new Date(Date.now() - 24 * 60 * 60 * 1000)))
      .catch(() => {});
  }

  if (row.count > limit) throw tooManyRequests(message);
}

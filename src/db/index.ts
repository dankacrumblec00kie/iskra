import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Единственное подключение к PostgreSQL на процесс.
 * В dev Next.js перезагружает модули при каждом изменении, поэтому клиент
 * кладём в globalThis — иначе каждое сохранение файла открывало бы новый пул.
 */
const globalForDb = globalThis as unknown as { __iskraSql?: ReturnType<typeof postgres> };

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[db] DATABASE_URL не задан — запросы к базе будут падать");
  }
  return postgres(url ?? "", {
    max: process.env.NODE_ENV === "production" ? 5 : 10,
    idle_timeout: 20,
    // Пулеры в transaction-режиме (Neon, Supabase) не поддерживают prepared statements
    prepare: false,
    onnotice: () => {},
  });
}

export const sql = globalForDb.__iskraSql ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.__iskraSql = sql;

export const db = drizzle(sql, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };

// npm run db:reset — удаляет все таблицы и применяет миграции заново. Только для локальной базы.
import "./_env";
import postgres from "postgres";
import { isLocalDatabaseUrl } from "./_local-db";
import { runMigrations } from "./migrate";

const url = process.env.DATABASE_URL;
if (!url || !isLocalDatabaseUrl(url)) {
  console.error("db:reset работает только с локальной базой (защита от случайного сброса продакшена)");
  process.exit(1);
}

const client = postgres(url, { max: 1, onnotice: () => {} });
await client.unsafe("drop schema if exists public cascade; create schema public; drop schema if exists drizzle cascade;");
await client.end();

await runMigrations(url);
console.log("[db] база пересоздана");

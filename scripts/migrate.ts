// npm run db:migrate — применяет SQL-миграции из ./drizzle и синхронизирует справочники.
import "./_env";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { syncInterestCatalog } from "../src/db/catalog";
import * as schema from "../src/db/schema";

export async function runMigrations(url: string) {
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    await syncInterestCatalog(db);
  } finally {
    await client.end();
  }
}

// Запуск напрямую, а не через import из dev.ts
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/migrate.ts")) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL не задан");
    process.exit(1);
  }
  await runMigrations(url);
  console.log("[db] миграции применены");
}

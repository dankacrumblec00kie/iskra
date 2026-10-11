// npm run dev — одна команда поднимает всё: локальный PostgreSQL, миграции и Next.js.
import "./_env";
import { spawn } from "node:child_process";
import { isLocalDatabaseUrl, startLocalDb } from "./_local-db";
import { runMigrations } from "./migrate";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL не задан. Скопируйте .env.example в .env.local");
  process.exit(1);
}

let stopDb: (() => Promise<void>) | null = null;
if (isLocalDatabaseUrl(url)) stopDb = await startLocalDb();

await runMigrations(url);
console.log("[db] миграции применены");

const next = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", ...process.argv.slice(2)],
  { stdio: "inherit" },
);

let closing = false;
const shutdown = async (code = 0) => {
  if (closing) return;
  closing = true;
  next.kill();
  if (stopDb) await stopDb();
  process.exit(code);
};
next.on("exit", (code) => shutdown(code ?? 0));
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

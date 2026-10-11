// npm run db:start — держит локальный PostgreSQL запущенным (для тестов, сидов, drizzle-kit).
import "./_env";
import { startLocalDb } from "./_local-db";

const stop = await startLocalDb();
if (!stop) {
  console.log("[pg] уже запущен");
  process.exit(0);
}

const shutdown = async () => {
  await stop();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
console.log("[pg] Ctrl+C для остановки");

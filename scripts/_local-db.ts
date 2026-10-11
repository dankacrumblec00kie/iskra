import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import postgres from "postgres";

/**
 * Локальный PostgreSQL для разработки без Docker.
 * Пакет embedded-postgres приносит настоящие бинарники PostgreSQL через npm,
 * данные лежат в .data/pg и переживают перезапуски.
 */
export const LOCAL_DB = {
  host: "127.0.0.1",
  port: 54329,
  user: "postgres",
  password: "postgres",
  databases: ["iskra", "iskra_test"],
};

const dataDir = path.resolve(".data/pg");

export function localUrl(database = "iskra") {
  const { user, password, host, port } = LOCAL_DB;
  return `postgres://${user}:${password}@${host}:${port}/${database}`;
}

/** true, если DATABASE_URL указывает на локальный встроенный PostgreSQL. */
export function isLocalDatabaseUrl(url: string | undefined) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return ["127.0.0.1", "localhost"].includes(u.hostname) && Number(u.port) === LOCAL_DB.port;
  } catch {
    return false;
  }
}

function portOpen(port: number, host: string) {
  return new Promise<boolean>((resolve) => {
    const socket = net.connect({ port, host });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/**
 * Запускает локальный PostgreSQL. Возвращает функцию остановки
 * или null, если сервер уже запущен другим процессом.
 */
export async function startLocalDb(): Promise<(() => Promise<void>) | null> {
  if (await portOpen(LOCAL_DB.port, LOCAL_DB.host)) return null;

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: LOCAL_DB.user,
    password: LOCAL_DB.password,
    port: LOCAL_DB.port,
    persistent: true,
    // На русской Windows initdb по умолчанию создал бы кластер в WIN1251.
    // Встроенная локаль C.UTF-8 даёт UTF-8 и корректный lower()/ILIKE для кириллицы.
    initdbFlags: [
      "--encoding=UTF8",
      "--locale-provider=builtin",
      "--builtin-locale=C.UTF-8",
      "--locale=C",
    ],
    onLog: () => {},
    onError: (e) => console.error("[pg]", e),
  });

  if (!fs.existsSync(path.join(dataDir, "PG_VERSION"))) {
    console.log("[pg] первый запуск: инициализация кластера в .data/pg");
    await pg.initialise();
  }
  await pg.start();

  const admin = postgres(localUrl("postgres"), { max: 1, onnotice: () => {} });
  try {
    for (const name of LOCAL_DB.databases) {
      const exists = await admin`select 1 from pg_database where datname = ${name}`;
      if (exists.length === 0) await admin.unsafe(`create database "${name}"`);
    }
  } finally {
    await admin.end();
  }

  console.log(`[pg] локальный PostgreSQL запущен на порту ${LOCAL_DB.port}`);
  return () => pg.stop();
}

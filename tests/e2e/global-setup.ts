import { config } from "dotenv";
import postgres from "postgres";

config({ path: [".env.local", ".env"], quiet: true });

/** Удаляет аккаунты, созданные тестами: каскады убирают их анкеты, пары и платежи. */
async function removeTestUsers(sql: postgres.Sql) {
  await sql`delete from users where email like 'e2e-%@test.local'`;
}

/**
 * Перед прогоном: чистим следы прошлых запусков и счётчики rate limit,
 * иначе повторные регистрации с одного адреса упрутся в ограничение.
 * Возвращаемая функция выполняется после всех тестов.
 */
export default async function globalSetup() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL не задан — e2e-тестам нужна база");

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await removeTestUsers(sql);
    await sql`delete from rate_limits`;
    const [{ count }] = await sql`select count(*)::int as count from users where is_demo`;
    if (count === 0) throw new Error("В базе нет демо-анкет. Выполните `npm run db:seed`");
  } finally {
    await sql.end();
  }

  return async () => {
    const cleanup = postgres(url, { max: 1, onnotice: () => {} });
    try {
      await removeTestUsers(cleanup);
    } finally {
      await cleanup.end();
    }
  };
}

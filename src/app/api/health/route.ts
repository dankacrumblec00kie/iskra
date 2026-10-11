import { sql } from "drizzle-orm";
import { connection, NextResponse } from "next/server";
import { db } from "@/db";

// Проверка живости для мониторинга и CI: приложение отвечает и видит базу.
export async function GET() {
  await connection();
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "db_unavailable" }, { status: 503 });
  }
}

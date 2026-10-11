import { notInArray, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { INTERESTS } from "../lib/shared/interests";
import * as schema from "./schema";

/** Приводит таблицу interests в соответствие со справочником в коде (идемпотентно). */
export async function syncInterestCatalog(db: PostgresJsDatabase<typeof schema>) {
  await db
    .insert(schema.interests)
    .values(INTERESTS.map((i, position) => ({ ...i, position })))
    .onConflictDoUpdate({
      target: schema.interests.slug,
      set: {
        label: sql`excluded.label`,
        emoji: sql`excluded.emoji`,
        category: sql`excluded.category`,
        position: sql`excluded.position`,
      },
    });

  await db.delete(schema.interests).where(
    notInArray(
      schema.interests.slug,
      INTERESTS.map((i) => i.slug),
    ),
  );
}

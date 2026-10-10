import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { E2E_DB } from "../../playwright.config";
import { TOPICS } from "../../src/domain/topics";

/** Fresh schema for every run. Test data is created through the app itself. */
export default async function globalSetup() {
  const sql = postgres(E2E_DB, { max: 1, onnotice: () => {} });
  await sql.unsafe("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  for (const t of TOPICS) await sql`INSERT INTO topics (slug, name) VALUES (${t.slug}, ${t.name})`;
  await sql.end();
}

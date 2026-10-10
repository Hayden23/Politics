import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type Executor = DB | Tx;

const globalForDb = globalThis as unknown as { __civicDb?: { db: DB; client: postgres.Sql } };

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, {
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
    onnotice: () => {},
    ssl: process.env.DATABASE_SSL === "require" ? "require" : undefined,
  });
  return { client, db: drizzle(client, { schema }) };
}

function instance() {
  if (!globalForDb.__civicDb) globalForDb.__civicDb = connect();
  return globalForDb.__civicDb;
}

/** Lazily connected so builds and imports don't require a database. */
export const db: DB = new Proxy({} as DB, {
  get(_t, prop) {
    const real = instance().db as unknown as Record<string | symbol, unknown>;
    const v = real[prop];
    return typeof v === "function" ? (v as Function).bind(real) : v;
  },
});

export async function closeDb() {
  if (globalForDb.__civicDb) {
    await globalForDb.__civicDb.client.end({ timeout: 5 });
    globalForDb.__civicDb = undefined;
  }
}

export { schema };

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema.ts";

export type Schema = typeof schema;
export type Db = PgDatabase<PgQueryResultHKT, Schema>;

// The container sets DATABASE_MIGRATIONS_DIR, because bundled code has no stable source path.
const MIGRATIONS = process.env.DATABASE_MIGRATIONS_DIR ?? join(dirname(fileURLToPath(import.meta.url)), "..", "drizzle");

/**
 * DATABASE_URL:
 * - `postgres://...` for Postgres (Docker Compose, production),
 * - `pglite:memory` or `pglite:./path` for local development and tests without Docker.
 * Migrations run on connect.
 */
export async function connectDb(url: string): Promise<Db> {
  if (url.startsWith("pglite:")) {
    const location = url.slice("pglite:".length);
    if (location !== "memory") mkdirSync(location, { recursive: true });
    const client = new PGlite(location === "memory" ? undefined : location);
    const db = drizzlePglite(client, { schema });
    await migratePglite(db, { migrationsFolder: MIGRATIONS });
    return db as unknown as Db;
  }
  const client = postgres(url, { max: 10 });
  const db = drizzlePostgres(client, { schema });
  await migratePostgres(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as Db;
}

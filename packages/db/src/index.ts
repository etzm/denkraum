export { createMemoryBlobStore } from "./blob-store.ts";
export type { BlobStore } from "./blob-store.ts";
export { connectDb } from "./client.ts";
export type { Db, Schema } from "./client.ts";
export { deleteLearner, exportLearner, runRetention } from "./retention-job.ts";
export type { RetentionReport } from "./retention-job.ts";
export * as schema from "./schema.ts";
// Query operators, re-exported so apps use the same drizzle-orm instance as the schema.
export { and, asc, desc, eq, gt, gte, inArray, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
// Table builders, re-exported so module tables (modules/*/*/*/db.ts) share this drizzle-orm instance.
export { boolean, index, integer, jsonb, pgTable, primaryKey, real, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

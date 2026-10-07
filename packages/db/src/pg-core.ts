// What a module needs to define its own tables (docs/module-sdk.md): the column builders and the
// platform tables to reference. Re-exported so modules use the same drizzle-orm instance.
export { boolean, index, integer, jsonb, pgTable, primaryKey, real, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
export { feedback, groups, learners, transcripts, uploads } from "./schema.ts";

/**
 * Database building blocks for modules, without a direct dependency on drizzle-orm:
 * table builders, the platform tables to reference, and query operators.
 *   import { pgTable, text, learners, eq } from "@denkraum/sdk/db";
 */
export * from "@denkraum/db/pg-core";
export { and, asc, desc, eq, gt, gte, inArray, isNull, lt, lte, ne, or, sql } from "@denkraum/db";
export type { Db } from "@denkraum/db";

/**
 * Test helpers for modules: an in-memory database with all migrations and an in-memory photo store.
 *   const db = await connectDb("pglite:memory");
 */
export { connectDb, createMemoryBlobStore, schema } from "@denkraum/db";

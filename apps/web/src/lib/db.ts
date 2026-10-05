import { connectDb, createMemoryBlobStore, type BlobStore, type Db } from "@denkraum/db";

// One connection per server process. Without DATABASE_URL, local development uses PGlite
// on disk, so `pnpm dev` works without Docker.
const globalForDb = globalThis as unknown as { denkraumDb?: Promise<Db>; denkraumBlobs?: BlobStore };

export function getDb(): Promise<Db> {
  globalForDb.denkraumDb ??= connectDb(process.env.DATABASE_URL ?? "pglite:./.data/pglite");
  return globalForDb.denkraumDb;
}

/** P1 replaces this with the S3 store for the private EU bucket. */
export function getBlobStore(): BlobStore {
  globalForDb.denkraumBlobs ??= createMemoryBlobStore();
  return globalForDb.denkraumBlobs;
}

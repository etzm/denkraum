/**
 * Daily deletion run (docs/datenschutz/README.md section 2). Run from cron or a scheduler.
 * Usage: pnpm --filter @denkraum/web retention
 */
import { connectDb, createMemoryBlobStore, runRetention } from "@denkraum/db";

const db = await connectDb(process.env.DATABASE_URL ?? "pglite:./.data/pglite");
// P1: replace with the S3 store once photos are stored there.
const report = await runRetention(db, createMemoryBlobStore());
console.log(JSON.stringify({ retention: report, at: new Date().toISOString() }));
process.exit(0);

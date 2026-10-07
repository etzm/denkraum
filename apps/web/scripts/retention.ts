/**
 * Daily deletion run (docs/datenschutz/README.md section 2). Run from cron or a scheduler.
 * Usage: pnpm --filter @denkraum/web retention
 */
import { connectDb, createBlobStoreFromEnv, runRetention } from "@denkraum/db";

const db = await connectDb(process.env.DATABASE_URL ?? "pglite:./.data/pglite");
const report = await runRetention(db, createBlobStoreFromEnv());
console.log(JSON.stringify({ retention: report, at: new Date().toISOString() }));
process.exit(0);

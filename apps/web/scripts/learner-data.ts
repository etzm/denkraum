/**
 * Data requests for one learner, found by the personal code (the school forwards the request).
 *   node apps/web/scripts/learner-data.ts export --code K7QM-X2PA > auskunft.json   (Art. 15, 20 GDPR)
 *   node apps/web/scripts/learner-data.ts delete --code K7QM-X2PA --ja              (Art. 17 GDPR)
 */
import { parseArgs } from "node:util";
import { connectDb, createBlobStoreFromEnv, eq, schema } from "@denkraum/db";
import { normalizeAccessCode } from "@denkraum/privacy";
import { deleteLearnerComplete, exportLearnerComplete } from "../src/lib/learner-data.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { code: { type: "string" }, ja: { type: "boolean", default: false } },
});
const command = positionals[0];
const code = normalizeAccessCode(values.code ?? "");
if (!code || (command !== "export" && command !== "delete")) {
  console.error("Aufruf: learner-data.ts export|delete --code XXXX-XXXX [--ja]");
  process.exit(2);
}

const db = await connectDb(process.env.DATABASE_URL ?? "pglite:./.data/pglite");
const [learner] = await db.select().from(schema.learners).where(eq(schema.learners.personalCode, code));
if (!learner) {
  console.error("Kein Eintrag mit diesem Code.");
  process.exit(1);
}

if (command === "export") {
  console.log(JSON.stringify(await exportLearnerComplete(db, learner.id), null, 2));
} else {
  if (!values.ja) {
    console.error(`Löscht ${learner.pseudonym} mit allen Daten und Fotos. Zum Bestätigen --ja anhängen.`);
    process.exit(1);
  }
  await deleteLearnerComplete(db, createBlobStoreFromEnv(), learner.id);
  console.error(`${learner.pseudonym} ist gelöscht.`);
}
process.exit(0);

/**
 * Creates two demo groups for local development and prints their join codes, and the
 * teacher code of the class.
 * Usage: pnpm --filter @denkraum/web seed
 * With --e2e the codes are fixed, for the end-to-end tests.
 */
import { connectDb, schema } from "@denkraum/db";
import { generateAccessCode } from "@denkraum/privacy";

const db = await connectDb(process.env.DATABASE_URL ?? "pglite:./.data/pglite");
const endsAt = new Date(new Date().getFullYear() + 1, 6, 31);
const e2e = process.argv.includes("--e2e");
const groups = await db
  .insert(schema.groups)
  .values([
    { kind: "class", label: "Demo Mathe 10", schulart: "gesamtschule", klasse: 10, joinCode: e2e ? "E2EM-ATHE" : generateAccessCode(), endsAt },
    { kind: "individual", label: "Demo Schreibwerkstatt 7", schulart: "gesamtschule", klasse: 7, joinCode: e2e ? "E2ED-EUTS" : generateAccessCode(), endsAt },
  ])
  .returning();
for (const g of groups) console.log(`${g.label}: ${g.joinCode}`);
const klasse10 = groups.find((g) => g.klasse === 10)!;
const [teacher] = await db
  .insert(schema.viewers)
  .values({ groupId: klasse10.id, role: "teacher", readCode: e2e ? "E2ET-EACH" : generateAccessCode() })
  .returning();
console.log(`${klasse10.label}, Lehrkraft: ${teacher!.readCode}`);
process.exit(0);

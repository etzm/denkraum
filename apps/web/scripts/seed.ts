/**
 * Creates two demo groups for local development and prints their join codes.
 * Usage: pnpm --filter @denkraum/web seed
 * With --e2e the codes are fixed, for the end-to-end tests.
 *
 * Schreibwerkstatt demo (synthetic data only): a new learner, a learner who finished stages 1
 * to 3 (completed with the mock model, never a real one), a parent code, and all content
 * approved for the group, which in real use an adult does one by one (D-022).
 */
import { connectDb, schema } from "@denkraum/db";
import { createMockProvider, loadLlmConfig } from "@denkraum/llm";
import { mockFixtures } from "@denkraum/mod-deutsch-schreibwerkstatt/fixtures";
import { approveAllContent, completeMissionTyped, recordStationPass, type Learner } from "@denkraum/mod-deutsch-schreibwerkstatt/server";
import { generateAccessCode, generatePseudonym } from "@denkraum/privacy";

const db = await connectDb(process.env.DATABASE_URL ?? "pglite:./.data/pglite");
const endsAt = new Date(new Date().getFullYear() + 1, 6, 31);
const e2e = process.argv.includes("--e2e");
const code = (fixed: string) => (e2e ? fixed : generateAccessCode());

const groups = await db
  .insert(schema.groups)
  .values([
    { kind: "class", label: "Demo Mathe 10", schulart: "gesamtschule", klasse: 10, joinCode: code("E2EM-ATHE"), endsAt },
    { kind: "individual", label: "Demo Schreibwerkstatt 7", schulart: "gesamtschule", klasse: 7, joinCode: code("E2ED-EUTS"), endsAt },
  ])
  .returning();
for (const g of groups) console.log(`${g.label}: ${g.joinCode}`);

const sw = groups.find((g) => g.klasse === 7)!;
await approveAllContent(db, sw.id);
const learners = await db
  .insert(schema.learners)
  .values([
    { groupId: sw.id, pseudonym: generatePseudonym(), personalCode: code("E2ES-CHUE") },
    { groupId: sw.id, pseudonym: generatePseudonym(), personalCode: code("E2EP-RAKT") },
  ])
  .returning();
const [fresh, advanced] = learners as [(typeof learners)[number], (typeof learners)[number]];
const [parent] = await db
  .insert(schema.viewers)
  .values({ groupId: sw.id, learnerId: advanced.id, role: "parent", readCode: code("E2EE-RWAC") })
  .returning();

const learner: Learner = {
  id: advanced.id,
  groupId: sw.id,
  pseudonym: advanced.pseudonym,
  personalCode: advanced.personalCode,
  joinCode: sw.joinCode,
  niveauEEnabled: false,
};
const deps = { db, llm: { provider: createMockProvider(mockFixtures), config: loadLlmConfig({ LLM_PROVIDER: "mock" }) } };
const now = new Date();
for (const station of ["st-01-01", "st-01-02", "st-02-01", "st-02-02", "st-03-01", "st-03-02", "st-04-01"]) {
  await recordStationPass(db, advanced.id, station, now);
}
for (const mission of ["m-01-01", "m-01-02", "m-02-01", "m-02-02", "m-03-01", "m-03-02"]) {
  await completeMissionTyped(deps, learner, mission);
}

console.log(`Schreibwerkstatt, neues Kind (${fresh.pseudonym}): ${fresh.personalCode}`);
console.log(`Schreibwerkstatt, Stufe 1 bis 3 geschafft (${advanced.pseudonym}): ${advanced.personalCode}`);
console.log(`Schreibwerkstatt, Elterncode: ${parent!.readCode}`);
process.exit(0);

/**
 * Creates a class or a home pilot group and prints its join code; a class also gets a teacher
 * code for the teacher view (DECISIONS.md D-017, D-030).
 * Usage:
 *   node apps/web/scripts/create-group.ts --klasse 10 --label "10b Mathe" --ende 2027-07-31
 *   node apps/web/scripts/create-group.ts --klasse 7 --kind individual --label "Pilot Schreibwerkstatt" --ende 2027-07-31
 * The label must not contain a child's name.
 */
import { parseArgs } from "node:util";
import { connectDb, schema } from "@denkraum/db";
import { generateAccessCode } from "@denkraum/privacy";

const { values } = parseArgs({
  options: {
    klasse: { type: "string" },
    label: { type: "string" },
    ende: { type: "string" },
    kind: { type: "string", default: "class" },
    schulart: { type: "string" },
  },
});

const klasse = Number(values.klasse);
if (![7, 10, 11].includes(klasse)) throw new Error("--klasse muss 7, 10 oder 11 sein.");
if (!values.label) throw new Error("--label fehlt, zum Beispiel \"10b Mathe\".");
const endsAt = new Date(`${values.ende ?? ""}T23:59:59+02:00`);
if (Number.isNaN(endsAt.getTime()) || endsAt <= new Date()) throw new Error("--ende muss ein Datum in der Zukunft sein (JJJJ-MM-TT).");
if (values.kind !== "class" && values.kind !== "individual") throw new Error("--kind ist class oder individual.");
const schulart = values.schulart ?? (klasse === 11 ? "gymnasium" : "gesamtschule");

const db = await connectDb(process.env.DATABASE_URL ?? "pglite:./.data/pglite");
const [group] = await db
  .insert(schema.groups)
  .values({ kind: values.kind, label: values.label, schulart, klasse, joinCode: generateAccessCode(), endsAt })
  .returning();
console.log(`Gruppe "${group!.label}" (${schulart}, Klasse ${klasse}) bis ${values.ende}`);
console.log(`Code für die Schülerinnen und Schüler: ${group!.joinCode}`);
if (group!.kind === "class") {
  const [teacher] = await db
    .insert(schema.viewers)
    .values({ groupId: group!.id, role: "teacher", readCode: generateAccessCode() })
    .returning();
  console.log(`Code für die Lehrkraft: ${teacher!.readCode} (nur an die Lehrkraft geben)`);
}
console.log(`Einstieg: https://denkraum.martinetzrodt.com/klasse${klasse}`);
process.exit(0);

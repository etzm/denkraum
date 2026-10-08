/**
 * Teacher codes for class groups that already exist (DECISIONS.md D-017, D-030).
 *   node apps/web/scripts/teacher-code.ts neu --gruppe K7QM-X2PA            new code for the class with this join code
 *   node apps/web/scripts/teacher-code.ts entziehen --code TCHR-XXXX --ja   code stops working, sessions end
 * Give a teacher code only to the teacher of the class.
 */
import { parseArgs } from "node:util";
import { connectDb } from "@denkraum/db";
import { addTeacherCode, revokeTeacherCode } from "../src/lib/teacher-codes.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { gruppe: { type: "string" }, code: { type: "string" }, ja: { type: "boolean", default: false } },
});
const command = positionals[0];
if (command !== "neu" && command !== "entziehen") {
  console.error("Aufruf: teacher-code.ts neu --gruppe XXXX-XXXX | entziehen --code XXXX-XXXX --ja");
  process.exit(2);
}

const ERRORS: Record<string, string> = {
  format: "Der Code hat 8 Zeichen, zum Beispiel K7QM-X2PA.",
  unknown: "Kein Eintrag mit diesem Code.",
  ended: "Diese Gruppe ist beendet.",
  individual: "Diese Gruppe ist ein Pilot zu Hause; dort gibt es keine Lehrkraft.",
};

const db = await connectDb(process.env.DATABASE_URL ?? "pglite:./.data/pglite");
if (command === "neu") {
  const result = await addTeacherCode(db, values.gruppe ?? "");
  if (!result.ok) {
    console.error(ERRORS[result.error]);
    process.exit(1);
  }
  console.log(`Gruppe "${result.group.label}" (Klasse ${result.group.klasse}), Lehrkraft-Codes: ${result.teacherCodes}`);
  console.log(`Code für die Lehrkraft: ${result.code} (nur an die Lehrkraft geben)`);
  console.log(`Einstieg: https://denkraum.martinetzrodt.com/klasse${result.group.klasse}`);
} else {
  if (!values.ja) {
    console.error("Der Code funktioniert danach nicht mehr, offene Sitzungen enden. Zum Bestätigen --ja anhängen.");
    process.exit(1);
  }
  const result = await revokeTeacherCode(db, values.code ?? "");
  if (!result.ok) {
    console.error(ERRORS[result.error]);
    process.exit(1);
  }
  console.log(`Lehrkraft-Code für "${result.groupLabel}" entzogen.`);
}
process.exit(0);

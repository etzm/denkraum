import { and, eq, schema, type Db } from "@denkraum/db";
import { generateAccessCode, normalizeAccessCode } from "@denkraum/privacy";

/**
 * Teacher codes of a class group (DECISIONS.md D-017, D-030), for the admin scripts. A class can
 * have several (co-teaching); a code can be withdrawn, for example when it was passed on.
 */

/** A new code that is not in use as join code, personal code or teacher code. */
export async function unusedAccessCode(db: Db, generate: () => string = generateAccessCode): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = generate();
    const [group, learner, viewer] = await Promise.all([
      db.query.groups.findFirst({ where: eq(schema.groups.joinCode, code) }),
      db.query.learners.findFirst({ where: eq(schema.learners.personalCode, code) }),
      db.query.viewers.findFirst({ where: eq(schema.viewers.readCode, code) }),
    ]);
    if (!group && !learner && !viewer) return code;
  }
  throw new Error("No unused access code found.");
}

export type AddTeacherCodeResult =
  | { ok: true; code: string; group: { label: string; klasse: number }; teacherCodes: number }
  | { ok: false; error: "format" | "unknown" | "ended" | "individual" };

/** Adds a teacher code to the class with this join code. Home pilot groups have no teacher. */
export async function addTeacherCode(db: Db, joinCode: string, now = new Date(), generate?: () => string): Promise<AddTeacherCodeResult> {
  const code = normalizeAccessCode(joinCode);
  if (!code) return { ok: false, error: "format" };
  const group = await db.query.groups.findFirst({ where: eq(schema.groups.joinCode, code) });
  if (!group) return { ok: false, error: "unknown" };
  if (group.endsAt <= now) return { ok: false, error: "ended" };
  if (group.kind !== "class") return { ok: false, error: "individual" };
  const readCode = await unusedAccessCode(db, generate);
  await db.insert(schema.viewers).values({ groupId: group.id, role: "teacher", readCode });
  const teachers = await db
    .select({ id: schema.viewers.id })
    .from(schema.viewers)
    .where(and(eq(schema.viewers.groupId, group.id), eq(schema.viewers.role, "teacher")));
  return { ok: true, code: readCode, group: { label: group.label, klasse: group.klasse }, teacherCodes: teachers.length };
}

/**
 * Withdraws a teacher code: the code stops working and open sessions end (cascade). Corrections
 * made with it stay in the log, without the reference to the code.
 */
export async function revokeTeacherCode(db: Db, teacherCode: string): Promise<{ ok: true; groupLabel: string } | { ok: false; error: "format" | "unknown" }> {
  const code = normalizeAccessCode(teacherCode);
  if (!code) return { ok: false, error: "format" };
  const viewer = await db.query.viewers.findFirst({ where: eq(schema.viewers.readCode, code) });
  if (!viewer || viewer.role !== "teacher") return { ok: false, error: "unknown" };
  const group = await db.query.groups.findFirst({ where: eq(schema.groups.id, viewer.groupId) });
  await db.delete(schema.viewers).where(eq(schema.viewers.id, viewer.id));
  return { ok: true, groupLabel: group?.label ?? "" };
}

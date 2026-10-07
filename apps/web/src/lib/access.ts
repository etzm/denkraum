import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, schema, type Db } from "@denkraum/db";
import { generateAccessCode, generatePseudonym, normalizeAccessCode } from "@denkraum/privacy";

export const SESSION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type EnterResult =
  | { ok: true; kind: "joined" | "resumed"; learnerId: string; klasse: number }
  | { ok: false; error: "format" | "unknown" | "ended" };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * One input field for children: a group code creates a new learner with a generated
 * pseudonym; a personal code continues as that learner.
 */
export async function enterWithCode(db: Db, input: string, now = new Date()): Promise<EnterResult> {
  const code = normalizeAccessCode(input);
  if (!code) return { ok: false, error: "format" };

  const existing = await db.query.learners.findFirst({
    where: eq(schema.learners.personalCode, code),
  });
  if (existing) {
    const group = await db.query.groups.findFirst({ where: eq(schema.groups.id, existing.groupId) });
    if (!group || group.endsAt <= now) return { ok: false, error: "ended" };
    await db.update(schema.learners).set({ lastActiveAt: now }).where(eq(schema.learners.id, existing.id));
    return { ok: true, kind: "resumed", learnerId: existing.id, klasse: group.klasse };
  }

  const group = await db.query.groups.findFirst({ where: eq(schema.groups.joinCode, code) });
  if (!group) return { ok: false, error: "unknown" };
  if (group.endsAt <= now) return { ok: false, error: "ended" };

  const taken = new Set(
    (await db.select({ p: schema.learners.pseudonym }).from(schema.learners).where(eq(schema.learners.groupId, group.id))).map(
      (r) => r.p,
    ),
  );
  let pseudonym = generatePseudonym();
  for (let i = 0; taken.has(pseudonym) && i < 50; i++) pseudonym = generatePseudonym();

  const [learner] = await db
    .insert(schema.learners)
    .values({ groupId: group.id, pseudonym, personalCode: generateAccessCode(), lastActiveAt: now })
    .returning({ id: schema.learners.id });
  return { ok: true, kind: "joined", learnerId: learner!.id, klasse: group.klasse };
}

/** Returns the cookie token. Only its hash is stored. */
export async function createSession(db: Db, learnerId: string, now = new Date()): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.insert(schema.sessions).values({
    tokenHash: hashToken(token),
    learnerId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_DAYS * DAY_MS),
  });
  return token;
}

export async function findLearnerBySession(db: Db, token: string, now = new Date()) {
  const [row] = await db
    .select({ learner: schema.learners, group: schema.groups })
    .from(schema.sessions)
    .innerJoin(schema.learners, eq(schema.sessions.learnerId, schema.learners.id))
    .innerJoin(schema.groups, eq(schema.learners.groupId, schema.groups.id))
    .where(and(eq(schema.sessions.tokenHash, hashToken(token)), gt(schema.sessions.expiresAt, now), gt(schema.groups.endsAt, now)));
  return row ?? null;
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, hashToken(token)));
}

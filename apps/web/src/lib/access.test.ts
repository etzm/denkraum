import { beforeEach, describe, expect, it } from "vitest";
import { connectDb, eq, schema, type Db } from "@denkraum/db";
import { createSession, deleteSession, enterWithCode, findLearnerBySession } from "./access.ts";
import { MODULES, modulesFor } from "./modules.ts";

const now = new Date("2026-10-20T08:00:00Z");
let db: Db;

beforeEach(async () => {
  db = await connectDb("pglite:memory");
  await db.insert(schema.groups).values([
    { kind: "class", label: "10b", schulart: "gesamtschule", klasse: 10, joinCode: "KXAS-SE29", endsAt: new Date("2027-07-31") },
    { kind: "class", label: "alt", schulart: "gesamtschule", klasse: 10, joinCode: "AXTE-GRPE", endsAt: new Date("2026-07-31") },
  ]);
});

describe("enterWithCode", () => {
  it("creates a learner with a generated pseudonym and personal code", async () => {
    const result = await enterWithCode(db, "kxas se29", now);
    expect(result).toMatchObject({ ok: true, kind: "joined" });
    const learner = await db.query.learners.findFirst();
    expect(learner?.pseudonym).toMatch(/^\S+ \S+ \d{2}$/);
    expect(learner?.personalCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it("resumes with the personal code", async () => {
    const joined = await enterWithCode(db, "KXAS-SE29", now);
    const learner = await db.query.learners.findFirst();
    const resumed = await enterWithCode(db, learner!.personalCode, now);
    expect(resumed).toEqual({ ok: true, kind: "resumed", learnerId: joined.ok ? joined.learnerId : "", klasse: 10 });
  });

  it("rejects malformed, unknown and ended codes", async () => {
    expect(await enterWithCode(db, "abc", now)).toEqual({ ok: false, error: "format" });
    expect(await enterWithCode(db, "ZZZZ-ZZZZ", now)).toEqual({ ok: false, error: "unknown" });
    expect(await enterWithCode(db, "AXTE-GRPE", now)).toEqual({ ok: false, error: "ended" });
  });
});

describe("sessions", () => {
  it("stores only a hash and ends cleanly", async () => {
    const joined = await enterWithCode(db, "KXAS-SE29", now);
    if (!joined.ok) throw new Error("join failed");
    const token = await createSession(db, joined.learnerId, now);
    const [stored] = await db.select().from(schema.sessions);
    expect(stored!.tokenHash).not.toBe(token);
    expect((await findLearnerBySession(db, token, now))?.learner.id).toBe(joined.learnerId);
    expect(await findLearnerBySession(db, token, new Date("2027-01-01"))).toBeNull();
    await deleteSession(db, token);
    expect(await db.select().from(schema.sessions).where(eq(schema.sessions.learnerId, joined.learnerId))).toHaveLength(0);
  });
});

describe("module registry", () => {
  it("lists modules by school type and grade", () => {
    expect(MODULES.map((m) => m.id).sort()).toEqual(["deutsch-schreibwerkstatt", "mathematik-trigonometrie"]);
    expect(modulesFor({ schulart: "gesamtschule", klasse: 10 }).map((m) => m.id)).toEqual(["mathematik-trigonometrie"]);
    expect(modulesFor({ schulart: "gymnasium", klasse: 11 })).toEqual([]);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { connectDb, eq, schema, type Db } from "@denkraum/db";
import { createSession, createViewerSession, deleteSession, enterWithCode, findLearnerBySession, findViewerBySession } from "./access.ts";
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
    expect(resumed).toEqual({ ok: true, kind: "resumed", learnerId: joined.ok && joined.kind !== "teacher" ? joined.learnerId : "", klasse: 10 });
  });

  it("rejects malformed, unknown and ended codes", async () => {
    expect(await enterWithCode(db, "abc", now)).toEqual({ ok: false, error: "format" });
    expect(await enterWithCode(db, "ZZZZ-ZZZZ", now)).toEqual({ ok: false, error: "unknown" });
    expect(await enterWithCode(db, "AXTE-GRPE", now)).toEqual({ ok: false, error: "ended" });
  });
});

describe("teacher codes", () => {
  async function addViewer(joinCode: string, role: "teacher" | "parent", readCode: string) {
    const group = await db.query.groups.findFirst({ where: eq(schema.groups.joinCode, joinCode) });
    const [viewer] = await db.insert(schema.viewers).values({ groupId: group!.id, role, readCode }).returning();
    return viewer!;
  }

  it("opens the group for its teacher without creating a learner", async () => {
    const viewer = await addViewer("KXAS-SE29", "teacher", "TCHR-CD23");
    expect(await enterWithCode(db, "tchr cd23", now)).toEqual({ ok: true, kind: "teacher", viewerId: viewer.id, klasse: 10 });
    expect(await db.select().from(schema.learners)).toHaveLength(0);
  });

  it("does not accept parent codes yet and refuses ended groups", async () => {
    await addViewer("KXAS-SE29", "parent", "PRNT-CD23");
    expect(await enterWithCode(db, "PRNT-CD23", now)).toEqual({ ok: false, error: "unknown" });
    await addViewer("AXTE-GRPE", "teacher", "TCHR-AXT2");
    expect(await enterWithCode(db, "TCHR-AXT2", now)).toEqual({ ok: false, error: "ended" });
  });

  it("keeps teacher and learner sessions apart", async () => {
    const viewer = await addViewer("KXAS-SE29", "teacher", "TCHR-CD23");
    const teacherToken = await createViewerSession(db, viewer.id, now);
    expect((await findViewerBySession(db, teacherToken, now))?.group.label).toBe("10b");
    expect(await findLearnerBySession(db, teacherToken, now)).toBeNull();

    const joined = await enterWithCode(db, "KXAS-SE29", now);
    if (!joined.ok || joined.kind === "teacher") throw new Error("join failed");
    const learnerToken = await createSession(db, joined.learnerId, now);
    expect(await findViewerBySession(db, learnerToken, now)).toBeNull();
    expect(await findViewerBySession(db, teacherToken, new Date("2027-08-01"))).toBeNull();
  });
});

describe("sessions", () => {
  it("stores only a hash and ends cleanly", async () => {
    const joined = await enterWithCode(db, "KXAS-SE29", now);
    if (!joined.ok || joined.kind === "teacher") throw new Error("join failed");
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

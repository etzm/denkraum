import { beforeEach, describe, expect, it } from "vitest";
import { connectDb, eq, schema, type Db } from "@denkraum/db";
import { createViewerSession, enterWithCode, findViewerBySession } from "./access.ts";
import { addTeacherCode, revokeTeacherCode, unusedAccessCode } from "./teacher-codes.ts";

const now = new Date("2026-10-20T08:00:00Z");
let db: Db;

beforeEach(async () => {
  db = await connectDb("pglite:memory");
  await db.insert(schema.groups).values([
    { kind: "class", label: "10b", schulart: "gesamtschule", klasse: 10, joinCode: "KXAS-SE29", endsAt: new Date("2027-07-31") },
    { kind: "individual", label: "Pilot", schulart: "gesamtschule", klasse: 7, joinCode: "PXHA-USE7", endsAt: new Date("2027-07-31") },
    { kind: "class", label: "alt", schulart: "gesamtschule", klasse: 10, joinCode: "AXTE-GRPE", endsAt: new Date("2026-07-31") },
  ]);
});

describe("teacher codes for existing groups", () => {
  it("adds a code that opens the class, also a second one for co-teaching", async () => {
    const first = await addTeacherCode(db, "kxas se29", now);
    if (!first.ok) throw new Error(first.error);
    expect(first).toMatchObject({ group: { label: "10b", klasse: 10 }, teacherCodes: 1 });
    expect(await enterWithCode(db, first.code, now)).toMatchObject({ ok: true, kind: "teacher", klasse: 10 });
    expect(await addTeacherCode(db, "KXAS-SE29", now)).toMatchObject({ ok: true, teacherCodes: 2 });
  });

  it("refuses home pilots, ended, unknown and malformed groups", async () => {
    expect(await addTeacherCode(db, "PXHA-USE7", now)).toEqual({ ok: false, error: "individual" });
    expect(await addTeacherCode(db, "AXTE-GRPE", now)).toEqual({ ok: false, error: "ended" });
    expect(await addTeacherCode(db, "ZZZZ-ZZZZ", now)).toEqual({ ok: false, error: "unknown" });
    expect(await addTeacherCode(db, "abc", now)).toEqual({ ok: false, error: "format" });
    expect(await db.select().from(schema.viewers)).toHaveLength(0);
  });

  it("never hands out a code that is already a join, personal or teacher code", async () => {
    const group = await db.query.groups.findFirst({ where: eq(schema.groups.joinCode, "KXAS-SE29") });
    await db.insert(schema.learners).values({ groupId: group!.id, pseudonym: "Roter Luchs 23", personalCode: "PRSN-CD23" });
    const candidates = ["KXAS-SE29", "PRSN-CD23", "NEWC-DE23"];
    expect(await unusedAccessCode(db, () => candidates.shift()!)).toBe("NEWC-DE23");
    await expect(unusedAccessCode(db, () => "KXAS-SE29")).rejects.toThrow("No unused access code");
  });

  it("withdraws a code: it stops working and its sessions end", async () => {
    const added = await addTeacherCode(db, "KXAS-SE29", now);
    if (!added.ok) throw new Error(added.error);
    const viewer = await db.query.viewers.findFirst();
    const token = await createViewerSession(db, viewer!.id, now);
    expect(await revokeTeacherCode(db, added.code)).toEqual({ ok: true, groupLabel: "10b" });
    expect(await enterWithCode(db, added.code, now)).toEqual({ ok: false, error: "unknown" });
    expect(await findViewerBySession(db, token, now)).toBeNull();
    expect(await db.select().from(schema.sessions)).toHaveLength(0);
    expect(await revokeTeacherCode(db, added.code)).toEqual({ ok: false, error: "unknown" });
    expect(await revokeTeacherCode(db, "KXAS-SE29")).toEqual({ ok: false, error: "unknown" });
  });
});

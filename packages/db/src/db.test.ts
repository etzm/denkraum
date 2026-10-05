import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { connectDb, createMemoryBlobStore, deleteLearner, exportLearner, runRetention, schema, type Db } from "./index.ts";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-20T08:00:00Z");

let db: Db;

async function seed(endsAt = new Date("2027-07-31T00:00:00Z")) {
  const [group] = await db
    .insert(schema.groups)
    .values({ kind: "class", label: "10b Mathe", schulart: "gesamtschule", klasse: 10, joinCode: `J${Math.random()}`, endsAt })
    .returning();
  const [learner] = await db
    .insert(schema.learners)
    .values({ groupId: group!.id, pseudonym: "Blauer Falke 42", personalCode: `P${Math.random()}` })
    .returning();
  return { group: group!, learner: learner! };
}

async function addUpload(learnerId: string, keys: string[], imagesDeleteAfter: Date) {
  const [upload] = await db
    .insert(schema.uploads)
    .values({ learnerId, moduleId: "mathematik-trigonometrie", kind: "worksheet", storageKeys: keys, imagesDeleteAfter })
    .returning();
  await db.insert(schema.transcripts).values({ uploadId: upload!.id, raw: { tasks: [] } });
  await db
    .insert(schema.feedback)
    .values({ uploadId: upload!.id, kind: "task", promptName: "feedback", promptVersion: 1, model: "mock", payload: {} });
  return upload!;
}

beforeEach(async () => {
  db = await connectDb("pglite:memory");
});

describe("retention job", () => {
  it("deletes due photos but keeps transcripts", async () => {
    const blobs = createMemoryBlobStore();
    const { learner } = await seed();
    await blobs.put("a.jpg", new Uint8Array([1]), "image/jpeg");
    await blobs.put("b.jpg", new Uint8Array([2]), "image/jpeg");
    const due = await addUpload(learner.id, ["a.jpg"], new Date(now.getTime() - DAY));
    await addUpload(learner.id, ["b.jpg"], new Date(now.getTime() + DAY));

    const report = await runRetention(db, blobs, now);
    expect(report.photoUploads).toBe(1);
    expect(blobs.keys()).toEqual(["b.jpg"]);
    const after = await db.query.uploads.findFirst({ where: eq(schema.uploads.id, due.id) });
    expect(after).toMatchObject({ storageKeys: [], imagesDeletedAt: now });
    expect(await db.select().from(schema.transcripts)).toHaveLength(2);

    expect((await runRetention(db, blobs, now)).photoUploads).toBe(0);
  });

  it("deletes a whole group after its end date, including photos", async () => {
    const blobs = createMemoryBlobStore();
    const ended = await seed(new Date(now.getTime() - DAY));
    const running = await seed();
    await blobs.put("old.jpg", new Uint8Array([1]), "image/jpeg");
    await addUpload(ended.learner.id, ["old.jpg"], new Date(now.getTime() + 10 * DAY));
    await addUpload(running.learner.id, [], new Date(now.getTime() + 10 * DAY));

    const report = await runRetention(db, blobs, now);
    expect(report.groups).toBe(1);
    expect(blobs.keys()).toEqual([]);
    expect(await db.select().from(schema.learners)).toHaveLength(1);
    expect(await db.select().from(schema.uploads)).toHaveLength(1);
    expect(await db.select().from(schema.transcripts)).toHaveLength(1);
  });

  it("deletes old model call logs and expired sessions", async () => {
    const { learner } = await seed();
    const call = {
      moduleId: "m",
      promptName: "p",
      promptVersion: 1,
      tier: "light",
      provider: "mock",
      model: "mock",
      attempt: 1,
      status: "ok",
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
    };
    await db.insert(schema.llmCalls).values([
      { ...call, createdAt: new Date(now.getTime() - 400 * DAY) },
      { ...call, createdAt: new Date(now.getTime() - 10 * DAY) },
    ]);
    await db.insert(schema.sessions).values([
      { tokenHash: "old", learnerId: learner.id, expiresAt: new Date(now.getTime() - 1) },
      { tokenHash: "new", learnerId: learner.id, expiresAt: new Date(now.getTime() + DAY) },
    ]);
    const report = await runRetention(db, createMemoryBlobStore(), now);
    expect(report).toMatchObject({ llmCalls: 1, sessions: 1 });
  });
});

describe("data subject rights", () => {
  it("exports everything about one learner", async () => {
    const { learner } = await seed();
    await addUpload(learner.id, ["x.jpg"], new Date(now.getTime() + DAY));
    const data = await exportLearner(db, learner.id);
    expect(data?.learner.pseudonym).toBe("Blauer Falke 42");
    expect(data?.uploads).toHaveLength(1);
    expect(data?.transcripts).toHaveLength(1);
    expect(data?.feedback).toHaveLength(1);
    expect(await exportLearner(db, "unknown")).toBeNull();
  });

  it("deletes a learner with all rows and photos", async () => {
    const blobs = createMemoryBlobStore();
    const { learner } = await seed();
    const other = await seed();
    await blobs.put("x.jpg", new Uint8Array([1]), "image/jpeg");
    await blobs.put("y.jpg", new Uint8Array([1]), "image/jpeg");
    await addUpload(learner.id, ["x.jpg"], new Date(now.getTime() + DAY));
    await addUpload(other.learner.id, ["y.jpg"], new Date(now.getTime() + DAY));

    expect(await deleteLearner(db, blobs, learner.id)).toBe(true);
    expect(blobs.keys()).toEqual(["y.jpg"]);
    expect(await db.select().from(schema.uploads)).toHaveLength(1);
    expect(await db.select().from(schema.feedback)).toHaveLength(1);
  });
});

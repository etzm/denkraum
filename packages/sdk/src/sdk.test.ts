import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { defineModule } from "@denkraum/core";
import { connectDb, createEncryptingBlobStore, createMemoryBlobStore, schema, type Db } from "@denkraum/db";
import { createMockProvider, loadLlmConfig } from "@denkraum/llm";
import { findMetadataSegments, IdentityLeakError } from "@denkraum/privacy";
import { acceptUpload, createModuleAi, createModuleUploads, deleteUploadImages, pickPrompt, readUploadPage, UploadError } from "./index.ts";

const manifest = defineModule({
  id: "test-modul",
  title: "Test",
  schulart: "gesamtschule",
  klasse: 10,
  fach: "Mathematik",
  niveaus: ["M"],
  devices: ["ipad"],
  offline: false,
  llmTiers: ["vision"],
  status: "entwicklung",
});

function segment(marker: number, payload: number[]): number[] {
  const len = payload.length + 2;
  return [0xff, marker, len >> 8, len & 0xff, ...payload];
}
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const jpegWithGps = () =>
  new Uint8Array([0xff, 0xd8, ...segment(0xe1, ascii("Exif\0\0GPS 47.99N 7.84E")), ...segment(0xda, [1, 1, 0, 0, 63, 0]), 0x12, 0x34, 0xff, 0xd9]);

let db: Db;
let learnerId: string;
let otherLearnerId: string;
const groupEndsAt = new Date("2027-07-31T00:00:00Z");
const now = new Date("2026-10-07T08:00:00Z");

beforeEach(async () => {
  db = await connectDb("pglite:memory");
  const [group] = await db
    .insert(schema.groups)
    .values({ kind: "class", label: "10b", schulart: "gesamtschule", klasse: 10, joinCode: "AAAA-BBBB", endsAt: groupEndsAt })
    .returning();
  const learners = await db
    .insert(schema.learners)
    .values([
      { groupId: group!.id, pseudonym: "Blauer Falke 42", personalCode: "CCCC-DDDD" },
      { groupId: group!.id, pseudonym: "Rote Eule 17", personalCode: "EEEE-FFFF" },
    ])
    .returning();
  learnerId = learners[0]!.id;
  otherLearnerId = learners[1]!.id;
});

describe("uploads", () => {
  it("strips metadata, encrypts at rest and sets the 14 day deletion date", async () => {
    const inner = createMemoryBlobStore();
    const blobs = createEncryptingBlobStore(inner, new Uint8Array(32).fill(1));
    const { uploadId, pages } = await acceptUpload({
      db, blobs, owner: { learnerId, groupEndsAt }, manifest, kind: "worksheet", ref: "sheet-1", maxPages: 4, pages: [jpegWithGps(), jpegWithGps()], now,
    });
    expect(pages).toBe(2);
    expect(inner.keys()).toEqual([`uploads/${uploadId}/1.jpg`, `uploads/${uploadId}/2.jpg`]);
    expect(Buffer.from(inner.raw(`uploads/${uploadId}/1.jpg`)!).includes(Buffer.from("GPS"))).toBe(false);

    const page = await readUploadPage(db, blobs, learnerId, uploadId, 1);
    expect(page).not.toBeNull();
    expect(findMetadataSegments(page!)).toEqual([]);
    expect(Buffer.from(page!).includes(Buffer.from("GPS"))).toBe(false);

    const [row] = await db.select().from(schema.uploads);
    expect(row!.imagesDeleteAfter).toEqual(new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000));
    expect(row!.ref).toBe("sheet-1");
  });

  it("refuses too many pages, empty uploads and non-JPEG data", async () => {
    const base = { db, blobs: createMemoryBlobStore(), owner: { learnerId, groupEndsAt }, manifest, kind: "worksheet", ref: null, maxPages: 1 };
    await expect(acceptUpload({ ...base, pages: [] })).rejects.toThrow(UploadError);
    await expect(acceptUpload({ ...base, pages: [jpegWithGps(), jpegWithGps()] })).rejects.toThrow(/Höchstens 1/);
    await expect(acceptUpload({ ...base, pages: [new Uint8Array([0x89, 0x50, 0x4e, 0x47])] })).rejects.toThrow(/kein JPEG/);
  });

  it("serves pages only to the owner and deletes on request", async () => {
    const blobs = createMemoryBlobStore();
    const { uploadId } = await acceptUpload({ db, blobs, owner: { learnerId, groupEndsAt }, manifest, kind: "worksheet", ref: null, maxPages: 2, pages: [jpegWithGps()], now });
    expect(await readUploadPage(db, blobs, otherLearnerId, uploadId, 1)).toBeNull();
    expect(await readUploadPage(db, blobs, learnerId, uploadId, 2)).toBeNull();
    expect(await deleteUploadImages(db, blobs, otherLearnerId, uploadId)).toBe(false);
    expect(await deleteUploadImages(db, blobs, learnerId, uploadId)).toBe(true);
    expect(blobs.keys()).toEqual([]);
    expect(await readUploadPage(db, blobs, learnerId, uploadId, 1)).toBeNull();
  });

  it("gives a module only its own learner's uploads and base64 images for the model", async () => {
    const blobs = createMemoryBlobStore();
    const { uploadId } = await acceptUpload({ db, blobs, owner: { learnerId, groupEndsAt }, manifest, kind: "worksheet", ref: "s1", maxPages: 2, pages: [jpegWithGps()], now });
    const mine = createModuleUploads(db, blobs, learnerId, "test-modul");
    expect((await mine.list("s1")).map((u) => u.id)).toEqual([uploadId]);
    expect(mine.pageUrls(uploadId, 1)).toEqual([`/api/uploads/${uploadId}/pages/1`]);
    const images = await mine.images(uploadId);
    expect(images[0]!.mediaType).toBe("image/jpeg");
    expect(Buffer.from(images[0]!.data, "base64").subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(await createModuleUploads(db, blobs, otherLearnerId, "test-modul").get(uploadId)).toBeNull();
    expect(await createModuleUploads(db, blobs, learnerId, "anderes-modul").get(uploadId)).toBeNull();
  });
});

const PROMPTS = {
  "feedback.v1.md": "---\nname: feedback\nversion: 1\nmodel_tier: light\noutput_schema: feedback\n---\nAlt",
  "feedback.v2.md": "---\nname: feedback\nversion: 2\nmodel_tier: light\noutput_schema: feedback\n---\nFormuliere eine Rückmeldung zu {{thema}}.",
};

describe("module AI", () => {
  it("picks the newest prompt version unless one is given", () => {
    expect(pickPrompt(PROMPTS, "feedback").version).toBe(2);
    expect(pickPrompt(PROMPTS, "feedback", 1).body).toBe("Alt");
    expect(() => pickPrompt(PROMPTS, "fehlt")).toThrow();
  });

  it("generates through the guard and logs the call without content", async () => {
    const ai = createModuleAi({
      moduleId: "test-modul",
      prompts: PROMPTS,
      provider: createMockProvider({ feedback: () => ({ text: "Gut gemacht." }) }),
      config: loadLlmConfig({ LLM_PROVIDER: "mock" }),
      identity: { pseudonym: "Blauer Falke 42", accessCodes: ["CCCC-DDDD"], ids: [learnerId] },
      db,
    });
    const result = await ai.generate({ prompt: "feedback", variables: { thema: "Sinus" }, input: { antwort: "4,59 cm" }, schema: z.object({ text: z.string() }) });
    expect(result).toMatchObject({ ok: true, data: { text: "Gut gemacht." }, promptVersion: 2 });
    const calls = await db.select().from(schema.llmCalls);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ moduleId: "test-modul", promptName: "feedback", promptVersion: 2, status: "ok", tier: "light" });
    await expect(ai.generate({ prompt: "feedback", variables: { thema: "x" }, input: { von: learnerId }, schema: z.object({}) })).rejects.toThrow(IdentityLeakError);
  });
});

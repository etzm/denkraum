import { beforeEach, describe, expect, it } from "vitest";
import { acceptUpload, createModuleAi, createModuleUploads, type ModuleContext, type TeacherContext } from "@denkraum/sdk";
import { and, eq, feedback, learners, transcripts, uploads } from "@denkraum/sdk/db";
import { connectDb, createMemoryBlobStore, schema } from "@denkraum/sdk/testing";
import { trigChecks, trigOverrides, trigResults, trigWorksheets } from "../db.ts";
import { exportLearner } from "../export.ts";
import { mockFeedback, mockTranscription, parseRequestInput, type FeedbackInput, type TranscribeInput } from "../domain/ai.ts";
import { formatInput } from "../domain/format.ts";
import { solutionAvailable } from "../domain/lesson.ts";
import { taskOverview } from "../domain/overview.ts";
import { solve } from "../domain/solutions.ts";
import { getTask } from "../domain/tasks.ts";
import { manifest } from "../module.ts";
import { PROMPTS } from "../prompts/index.ts";
import { ACTIONS } from "../server/actions.ts";
import { countedOf } from "../server/store.ts";
import { overviewAttempts, TEACHER_ACTIONS } from "../server/teacher.ts";

// The lesson 4 flow on an in-memory database with the module's mock answers: what the actions
// store and decide. Synthetic data only (docs/datenschutz/README.md, section 7).

type AiDeps = Parameters<typeof createModuleAi>[0];
type Provider = AiDeps["provider"];
type ProviderRequest = Parameters<Provider["complete"]>[0];
type Override = (request: ProviderRequest) => { json: unknown; stopReason?: string } | undefined;

const PSEUDONYM = "Roter Luchs 23";
const PERSONAL_CODE = "TEST-R4LX";
const JOIN_CODE = "TEST-GR10";

/** Tiny synthetic JPEG: start, scan, end. No real photo, no metadata. */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 63, 0, 0x12, 0x34, 0xff, 0xd9]);

function provider(overrides: Partial<Record<string, Override>> = {}): Provider & { requests: ProviderRequest[] } {
  const requests: ProviderRequest[] = [];
  return {
    name: "mock",
    requests,
    async complete(request) {
      requests.push(request);
      const custom = overrides[request.promptName]?.(request);
      const input = parseRequestInput(request.userText);
      const json =
        custom?.json ??
        (request.promptName === "transcribe" ? mockTranscription(input as TranscribeInput) : mockFeedback(input as FeedbackInput));
      return { json, stopReason: custom?.stopReason ?? "end_turn", model: "mock", inputTokens: 0, outputTokens: 0 };
    },
  };
}

async function setup(model = provider()) {
  const db = await connectDb("pglite:memory");
  const blobs = createMemoryBlobStore();
  const endsAt = new Date("2027-07-31T00:00:00Z");
  const [group] = await db
    .insert(schema.groups)
    .values({ kind: "class", label: "Test 10", schulart: "gesamtschule", klasse: 10, joinCode: JOIN_CODE, endsAt })
    .returning();
  const [learner] = await db.insert(learners).values({ groupId: group!.id, pseudonym: PSEUDONYM, personalCode: PERSONAL_CODE }).returning();
  const config: AiDeps["config"] = {
    provider: "mock",
    models: { vision: "mock", hard: "mock", light: "mock" },
    awsRegion: undefined,
    baseUrl: undefined,
    apiKey: undefined,
    timeoutMs: 5000,
    maxTokens: 4000,
    prices: {},
  };
  const context = (niveau: "G" | "M" | "E" | null): ModuleContext => ({
    manifest,
    learner: { id: learner!.id, niveau, niveauEEnabled: false },
    group: { id: group!.id, schulart: "gesamtschule", klasse: 10, endsAt },
    basePath: "/klasse10/m/mathematik-trigonometrie",
    db,
    ai: createModuleAi({
      moduleId: manifest.id,
      prompts: PROMPTS,
      provider: model,
      config,
      identity: { pseudonym: PSEUDONYM, accessCodes: [PERSONAL_CODE, JOIN_CODE], ids: [learner!.id, group!.id] },
      db,
    }),
    uploads: createModuleUploads(db, blobs, learner!.id, manifest.id),
    action: () => async () => {},
    now: new Date("2026-10-07T10:00:00Z"),
  });
  const upload = async (sheetId: string) =>
    (
      await acceptUpload({
        db,
        blobs,
        owner: { learnerId: learner!.id, groupEndsAt: endsAt },
        manifest,
        kind: "worksheet",
        ref: sheetId,
        maxPages: 6,
        pages: [JPEG],
      })
    ).uploadId;
  return { db, learnerId: learner!.id, context, upload, model };
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

async function run(ctx: ModuleContext, name: string, fields: Record<string, string> = {}) {
  const result = await ACTIONS[name]!(ctx, form(fields));
  return result?.redirect ?? "";
}

/** Both faded tasks of lesson 4 solved on level M. */
async function solveFaded(ctx: ModuleContext) {
  await run(ctx, "luecke", { task: "L4-A3", s2: "Umstellen: b = c · sin β", s3: "7,66" });
  await run(ctx, "luecke", { task: "L4-A4", s2: "Umstellen: a = b · tan α", s3: "4,2" });
}

/** Confirm-screen fields with the model values, optionally overriding single values. */
function confirmFields(sheet: typeof trigWorksheets.$inferSelect, uploadId: string, change: Record<string, string> = {}) {
  const fields: Record<string, string> = { blatt: sheet.id, upload: uploadId };
  for (const id of sheet.taskIds) {
    const task = getTask(id);
    const s = solve(task.solution_fn, sheet.params[id]!, sheet.niveau);
    if (s.kind !== "numeric") throw new Error("numeric expected");
    for (const q of task.levels[sheet.niveau]!.sought) {
      fields[`v.${id}.${q}`] = formatInput(s.values[q]!);
      fields[`u.${id}.${q}`] = s.units[q]!;
    }
    fields[`skizze.${id}`] = "ja";
    fields[`satz.${id}`] = "ja";
  }
  return { ...fields, ...change };
}

describe("lesson 4 actions", () => {
  let env: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    env = await setup();
  });

  it("stores the level on the platform learner", async () => {
    expect(await run(env.context(null), "niveau", { niveau: "E" })).toBe("/klasse10/m/mathematik-trigonometrie");
    const [row] = await env.db.select().from(learners).where(eq(learners.id, env.learnerId));
    expect(row!.niveau).toBe("E");
    await run(env.context(null), "niveau", { niveau: "X" });
    const [same] = await env.db.select().from(learners).where(eq(learners.id, env.learnerId));
    expect(same!.niveau).toBe("E");
  });

  it("keeps the worksheet closed until both faded tasks are done", async () => {
    const ctx = env.context("M");
    expect(await run(ctx, "blatt_oeffnen")).toMatch(/\/lektion\/4\/uebung$/);
    expect(await env.db.select().from(trigWorksheets)).toHaveLength(0);

    await run(ctx, "luecke", { task: "L4-A3", s2: "Umstellen: b = c · sin β", s3: "6,43" });
    const [wrong] = await env.db.select().from(trigChecks);
    expect(wrong).toMatchObject({ taskId: "L4-A3", attemptNo: 1, correct: false, misconceptionCodes: ["F2", "F3"] });
    expect(wrong!.hint).toMatch(/gegenüber/);

    await solveFaded(ctx);
    const redirect = await run(ctx, "blatt_oeffnen");
    const [sheet] = await env.db.select().from(trigWorksheets);
    expect(redirect).toBe(`/klasse10/m/mathematik-trigonometrie/blatt/${sheet!.id}`);
    expect(sheet).toMatchObject({ lesson: 4, niveau: "M", withHelp: false, taskIds: ["L4-A2", "L4-A5", "L4-A6", "L4-A7"] });
    expect(sheet!.sheetCode).toMatch(/^[A-Z2-9]{4}$/);
    // The open sheet is reused, not replaced.
    expect(await run(ctx, "blatt_oeffnen")).toBe(redirect);
  });

  it("marks the sheet 'mit Hilfe' after three wrong attempts at a faded task", async () => {
    const ctx = env.context("G");
    for (let i = 0; i < 4; i++) await run(ctx, "luecke", { task: "L4-A3", s3: "1" });
    // The fourth attempt is not stored: the task is done after three.
    expect(await env.db.select().from(trigChecks)).toHaveLength(3);
    await run(ctx, "luecke", { task: "L4-A4", s3: "4,2" });
    await run(ctx, "blatt_oeffnen");
    const [sheet] = await env.db.select().from(trigWorksheets);
    expect(sheet!.withHelp).toBe(true);
  });

  it("reads, confirms, verifies and phrases: right values pass the lesson", async () => {
    const ctx = env.context("M");
    await solveFaded(ctx);
    await run(ctx, "blatt_oeffnen");
    const [sheet] = await env.db.select().from(trigWorksheets);
    const uploadId = await env.upload(sheet!.id);

    expect(await run(ctx, "lesen", { blatt: sheet!.id, upload: uploadId })).toBe(
      `/klasse10/m/mathematik-trigonometrie/blatt/${sheet!.id}/pruefen?upload=${uploadId}`,
    );
    const [raw] = await env.db.select().from(transcripts).where(eq(transcripts.uploadId, uploadId));
    expect(raw!.raw).toMatchObject({ prompt_name: "transcribe", prompt_version: 2, model: "mock" });
    expect(raw!.legibility).toBeCloseTo(0.95);
    // Reading twice does not call the model twice.
    await run(ctx, "lesen", { blatt: sheet!.id, upload: uploadId });
    expect(env.model.requests.filter((r) => r.promptName === "transcribe")).toHaveLength(1);

    expect(await run(ctx, "bestaetigen", confirmFields(sheet!, uploadId))).toMatch(/\/ergebnis$/);
    const results = await env.db.select().from(trigResults);
    expect(results.map((r) => [r.taskId, r.status, r.attemptNo, r.feedbackSource])).toEqual([
      ["L4-A2", "correct", 1, "ai"],
      ["L4-A5", "correct", 1, "ai"],
      ["L4-A6", "correct", 1, "ai"],
      ["L4-A7", "correct", 1, "ai"],
    ]);
    const stored = await env.db.select().from(feedback);
    expect(stored).toHaveLength(4);
    expect(stored[0]).toMatchObject({ kind: "trig_task", promptName: "feedback", promptVersion: 1, model: "mock" });
    const [confirmed] = await env.db.select().from(transcripts).where(eq(transcripts.uploadId, uploadId));
    expect(confirmed!.confirmedAt).not.toBeNull();
    expect(confirmed!.editDistanceRatio).toBe(0);

    // Every model call is logged without content, and no prompt contained the learner's identity.
    expect(await env.db.select().from(schema.llmCalls)).toHaveLength(5);
    for (const request of env.model.requests) {
      const sent = `${request.system}\n${request.userText}`;
      for (const secret of [PSEUDONYM, PERSONAL_CODE, JOIN_CODE, env.learnerId]) expect(sent).not.toContain(secret);
    }

    // A second confirm does not store anything twice.
    await run(ctx, "bestaetigen", confirmFields(sheet!, uploadId));
    expect(await env.db.select().from(trigResults)).toHaveLength(4);
  });

  it("a wrong value is incorrect with its code; the full solution opens after the second failed attempt", async () => {
    const ctx = env.context("M");
    await solveFaded(ctx);
    await run(ctx, "blatt_oeffnen");
    const [first] = await env.db.select().from(trigWorksheets);
    const upload1 = await env.upload(first!.id);
    await run(ctx, "lesen", { blatt: first!.id, upload: upload1 });
    await run(ctx, "bestaetigen", confirmFields(first!, upload1, { "v.L4-A2.a": "-3,43" }));
    const [r1] = await env.db.select().from(trigResults).where(eq(trigResults.taskId, "L4-A2"));
    expect(r1).toMatchObject({ status: "incorrect", misconceptionCodes: ["F1"], attemptNo: 1 });

    expect(await run(ctx, "loesung", { blatt: first!.id, task: "L4-A2" })).toMatch(/\/ergebnis$/);

    const next = await run(ctx, "neu");
    const sheets = await env.db.select().from(trigWorksheets);
    const second = sheets.find((s) => next.endsWith(s.id))!;
    expect(second.taskIds).toEqual(["L4-A2"]);
    expect(second.attempts).toEqual({ "L4-A2": 2 });
    expect(second.params["L4-A2"]).not.toEqual(first!.params["L4-A2"]);

    const upload2 = await env.upload(second.id);
    await run(ctx, "lesen", { blatt: second.id, upload: upload2 });
    await run(ctx, "bestaetigen", confirmFields(second, upload2, { "v.L4-A2.a": "-3,43" }));
    expect(await run(ctx, "loesung", { blatt: second.id, task: "L4-A2" })).toBe(
      `/klasse10/m/mathematik-trigonometrie/blatt/${second.id}/loesung/L4-A2`,
    );
    const [viewed] = await env.db
      .select()
      .from(trigResults)
      .where(and(eq(trigResults.worksheetId, second.id), eq(trigResults.taskId, "L4-A2")));
    expect(viewed).toMatchObject({ solutionViewed: true, attemptNo: 2 });
    expect(viewed!.solutionViewedAt).toEqual(new Date("2026-10-07T10:00:00Z"));
  });

  it("deletes the photos on request and keeps the transcript", async () => {
    const ctx = env.context("M");
    await solveFaded(ctx);
    await run(ctx, "blatt_oeffnen");
    const [sheet] = await env.db.select().from(trigWorksheets);
    const uploadId = await env.upload(sheet!.id);
    await run(ctx, "lesen", { blatt: sheet!.id, upload: uploadId });
    expect(await run(ctx, "fotos_loeschen", { blatt: sheet!.id, upload: uploadId })).toMatch(/fotos=geloescht$/);
    expect((await ctx.uploads.get(uploadId))!.imagesDeletedAt).not.toBeNull();
    expect(await env.db.select().from(transcripts)).toHaveLength(1);
  });

  it("refuses uploads and sheets of someone else", async () => {
    const ctx = env.context("M");
    await solveFaded(ctx);
    await run(ctx, "blatt_oeffnen");
    const [sheet] = await env.db.select().from(trigWorksheets);
    const uploadId = await env.upload("another-sheet");
    expect(await run(ctx, "lesen", { blatt: sheet!.id, upload: uploadId })).toBe("/klasse10/m/mathematik-trigonometrie");
    expect(await run(ctx, "lesen", { blatt: "unknown", upload: uploadId })).toBe("/klasse10/m/mathematik-trigonometrie");
    expect(await env.db.select().from(transcripts)).toHaveLength(0);
  });
});

describe("when the model fails (D-014)", () => {
  it("a refused transcription leads to typed input; a refused feedback to the catalog hint", async () => {
    const env = await setup(provider({ transcribe: () => ({ json: null, stopReason: "refusal" }), feedback: () => ({ json: null, stopReason: "refusal" }) }));
    const ctx = env.context("M");
    await solveFaded(ctx);
    await run(ctx, "blatt_oeffnen");
    const [sheet] = await env.db.select().from(trigWorksheets);
    const uploadId = await env.upload(sheet!.id);
    await run(ctx, "lesen", { blatt: sheet!.id, upload: uploadId });
    const [raw] = await env.db.select().from(transcripts);
    expect(raw!.raw).toMatchObject({ failure: "refused" });

    await run(ctx, "bestaetigen", confirmFields(sheet!, uploadId, { "v.L4-A2.a": "-3,43" }));
    const results = await env.db.select().from(trigResults);
    expect(results.every((r) => r.feedbackSource === "refused" && r.feedbackId === null)).toBe(true);
    expect(results.find((r) => r.taskId === "L4-A2")!.status).toBe("incorrect");
    expect(results.filter((r) => r.status === "correct")).toHaveLength(3);
    expect(await env.db.select().from(feedback)).toHaveLength(0);
  });

  it("a feedback text that names the result is replaced by the catalog hint", async () => {
    const leaky = (request: ProviderRequest) => {
      const input = parseRequestInput(request.userText) as FeedbackInput;
      const value = input.model_solution.values[getTask(input.task.task_id).levels.M!.sought[0]!];
      return { json: { ...mockFeedback(input), hint: `Richtig wäre ${value}.` } };
    };
    const env = await setup(provider({ feedback: leaky }));
    const ctx = env.context("M");
    await solveFaded(ctx);
    await run(ctx, "blatt_oeffnen");
    const [sheet] = await env.db.select().from(trigWorksheets);
    const uploadId = await env.upload(sheet!.id);
    await run(ctx, "lesen", { blatt: sheet!.id, upload: uploadId });
    await run(ctx, "bestaetigen", confirmFields(sheet!, uploadId, { "v.L4-A2.a": "-3,43" }));
    const results = await env.db.select().from(trigResults);
    expect(results.find((r) => r.taskId === "L4-A2")).toMatchObject({ feedbackSource: "reveal_guard", feedbackId: null });
    // Where the learner has the value already, repeating it gives nothing away.
    expect(results.filter((r) => r.feedbackSource === "ai")).toHaveLength(3);
  });
});

describe("teacher view (D-030, D-031)", () => {
  let env: Awaited<ReturnType<typeof setup>>;
  let teacher: TeacherContext;
  const BASE = "/klasse10/lehrkraft/m/mathematik-trigonometrie";

  beforeEach(async () => {
    env = await setup();
    const [group] = await env.db.select().from(schema.groups);
    const [viewer] = await env.db.insert(schema.viewers).values({ groupId: group!.id, role: "teacher", readCode: "TEST-KTRR" }).returning();
    teacher = {
      manifest,
      viewer: { id: viewer!.id },
      group: { id: group!.id, label: group!.label, schulart: group!.schulart, klasse: group!.klasse, endsAt: group!.endsAt },
      learners: [{ id: env.learnerId, pseudonym: PSEUDONYM }],
      basePath: BASE,
      db: env.db,
      action: () => async () => {},
      now: new Date("2026-10-07T11:00:00Z"),
    };
  });

  async function correct(fields: Record<string, string>) {
    const result = await TEACHER_ACTIONS.korrigieren!(teacher, form(fields));
    return result?.redirect ?? "";
  }

  /** One sheet with L4-A2 in RAD mode (F1), the other three tasks right. */
  async function sheetWithF1(ctx: ModuleContext) {
    const sheetId = (await run(ctx, "blatt_oeffnen")).split("/").pop()!;
    const [sheet] = await env.db.select().from(trigWorksheets).where(eq(trigWorksheets.id, sheetId));
    if (!sheet) throw new Error("no open sheet");
    const uploadId = await env.upload(sheet.id);
    await run(ctx, "lesen", { blatt: sheet.id, upload: uploadId });
    await run(ctx, "bestaetigen", confirmFields(sheet, uploadId, { "v.L4-A2.a": "-3,43" }));
    const [result] = await env.db.select().from(trigResults).where(and(eq(trigResults.worksheetId, sheet.id), eq(trigResults.taskId, "L4-A2")));
    return result!;
  }

  it("shows the error picture of the own group only", async () => {
    const ctx = env.context("M");
    await solveFaded(ctx);
    await sheetWithF1(ctx);

    // A learner of another group with the same error must not show up.
    const [other] = await env.db
      .insert(schema.groups)
      .values({ kind: "class", label: "Andere 10", schulart: "gesamtschule", klasse: 10, joinCode: "TEST-ANDR", endsAt: new Date("2027-07-31") })
      .returning();
    const [stranger] = await env.db.insert(learners).values({ groupId: other!.id, pseudonym: "Grüner Igel 11", personalCode: "TEST-GR11" }).returning();
    const [sheet] = await env.db
      .insert(trigWorksheets)
      .values({ learnerId: stranger!.id, lesson: 4, niveau: "M", seed: "s", sheetCode: "ABCD", taskIds: ["L4-A2"], params: {}, attempts: {} })
      .returning();
    const [upload] = await env.db
      .insert(uploads)
      .values({ learnerId: stranger!.id, moduleId: manifest.id, kind: "worksheet", ref: sheet!.id, imagesDeleteAfter: new Date("2026-10-21") })
      .returning();
    await env.db.insert(trigResults).values({
      learnerId: stranger!.id,
      worksheetId: sheet!.id,
      uploadId: upload!.id,
      taskId: "L4-A2",
      attemptNo: 1,
      status: "incorrect",
      misconceptionCodes: ["F1"],
      verification: {},
      feedbackSource: "ai",
    });

    const [a2] = taskOverview(["L4-A2"], await overviewAttempts(teacher, ["L4-A2"], ["L4-A3"]));
    expect(a2).toMatchObject({ learners: 1, latest: { incorrect: 1 } });
    expect(a2!.codes.map((c) => [c.code, c.learnerIds])).toEqual([["F1", [env.learnerId]]]);
    // Someone else's result cannot be corrected.
    const [strangerResult] = await env.db.select().from(trigResults).where(eq(trigResults.learnerId, stranger!.id));
    expect(await correct({ ergebnis: strangerResult!.id, wahl: "status:correct", grund: "Versuch einer fremden Lehrkraft" })).toBe(BASE);
    expect(await env.db.select().from(trigOverrides)).toHaveLength(0);
  });

  it("sets a new status with a reason; lesson rules, error picture and export use it", async () => {
    const ctx = env.context("M");
    await solveFaded(ctx);
    const result = await sheetWithF1(ctx);

    expect(await correct({ ergebnis: result.id, wahl: "status:correct", grund: "  Rechner stand auf DEG, Foto falsch gelesen " })).toBe(
      `${BASE}/lernende/${env.learnerId}?gespeichert=${result.id}#ergebnis-${result.id}`,
    );
    const [row] = await env.db.select().from(trigOverrides);
    expect(row).toMatchObject({ learnerId: env.learnerId, viewerId: teacher.viewer.id, kind: "status", status: "correct", reason: "Rechner stand auf DEG, Foto falsch gelesen" });
    // The stored result stays as verify() decided it; the correction is a separate log entry.
    const [stored] = await env.db.select().from(trigResults).where(eq(trigResults.id, result.id));
    expect(stored!.status).toBe("incorrect");

    const counted = await countedOf(ctx, ["L4-A2"]);
    expect(counted).toMatchObject([{ status: "correct", originalStatus: "incorrect", codes: [] }]);
    const [a2] = taskOverview(["L4-A2"], await overviewAttempts(teacher, ["L4-A2"], []));
    expect(a2).toMatchObject({ latest: { correct: 1, incorrect: 0 }, codes: [] });
    expect((await exportLearner(env.db, env.learnerId)).trig_overrides).toHaveLength(1);
  });

  it("an attempt that does not count gives the learner another attempt", async () => {
    const ctx = env.context("M");
    await solveFaded(ctx);
    const first = await sheetWithF1(ctx);
    await run(ctx, "neu");
    await sheetWithF1(ctx);
    expect(solutionAvailable(await countedOf(ctx, ["L4-A2"]), "L4-A2")).toBe(true);

    await correct({ ergebnis: first.id, wahl: "void", grund: "Foto war unscharf, Aufgabe neu rechnen" });
    const counted = await countedOf(ctx, ["L4-A2"]);
    expect(counted.map((r) => r.attemptNo)).toEqual([1]);
    expect(solutionAvailable(counted, "L4-A2")).toBe(false);

    // Taking the correction back restores the count; the log keeps both entries.
    await correct({ ergebnis: first.id, wahl: "clear", grund: "Doch gewertet, Foto war lesbar" });
    expect((await countedOf(ctx, ["L4-A2"])).map((r) => r.attemptNo)).toEqual([1, 2]);
    expect(await env.db.select().from(trigOverrides)).toHaveLength(2);
  });

  it("refuses a correction without a reason or without a change", async () => {
    const ctx = env.context("M");
    await solveFaded(ctx);
    const result = await sheetWithF1(ctx);
    const page = `${BASE}/lernende/${env.learnerId}`;
    expect(await correct({ ergebnis: result.id, wahl: "status:correct", grund: "ok" })).toBe(`${page}?fehler=reason&ergebnis=${result.id}#ergebnis-${result.id}`);
    expect(await correct({ ergebnis: result.id, wahl: "status:incorrect", grund: "bleibt falsch" })).toBe(
      `${page}?fehler=unchanged&ergebnis=${result.id}#ergebnis-${result.id}`,
    );
    expect(await correct({ ergebnis: result.id, wahl: "clear", grund: "nichts zurückzunehmen" })).toMatch(/fehler=unchanged/);
    expect(await correct({ ergebnis: result.id, wahl: "loeschen", grund: "unbekannte Wahl" })).toMatch(/fehler=kind/);
    expect(await env.db.select().from(trigOverrides)).toHaveLength(0);
  });
});

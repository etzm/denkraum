import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, feedback, learners, transcripts, uploads, type Db } from "@denkraum/sdk/db";
import type { ModuleContext } from "@denkraum/sdk";
import { swMissionRuns } from "../db.ts";
import { APP_REVISION_TASK } from "../domain/feedback.ts";
import { ACTIONS } from "../mission/actions.ts";
import { MOCK_MARKERS } from "../mission/mocks.ts";
import { findRun } from "../mission/store.ts";
import { createTestContext, fixtureProvider, form, PSEUDONYM } from "./context.ts";

/** A synthetic text for m-04-01 with five paragraphs and well over 80 words. */
export const SAMPLE_TEXT = [
  "An unserer Schule wird gerade diskutiert, ob die Mittagspause länger werden soll. Ich bin der Meinung, dass wir eine längere Mittagspause brauchen.",
  "Zunächst können wir in einer längeren Pause in Ruhe essen. Im Moment müssen viele schnell essen, weil die Schlange in der Mensa lang ist. Gestern hatte ich zum Beispiel nur zehn Minuten für mein Essen.",
  "Außerdem bleibt mehr Zeit für Freunde. Wer zusammen spielt, versteht sich besser. In unserer Klasse wurde letzte Woche ein Streit in der Pause geklärt.",
  "Vor allem aber können wir uns am Nachmittag besser konzentrieren. Wer sich in der Pause bewegt hat, ist danach wacher. Nach einer kurzen Pause sind zum Beispiel viele im Mathematikunterricht müde.",
  "Aus diesen Gründen bitte ich die Schulkonferenz, die Mittagspause zu verlängern.",
].join("\n");

export const GOOD_PLAN = {
  thema: "Längere Mittagspause",
  standpunkt: "Ich bin für eine längere Mittagspause.",
  a1_behauptung: "mehr Zeit zum Essen",
  a1_begruendung: "Schlange in der Mensa",
  a1_beispiel: "gestern nur zehn Minuten",
  a2_behauptung: "Zeit für Freunde",
  a2_begruendung: "Streit wird geklärt",
  a2_beispiel: "Streit letzte Woche",
  a3_behauptung: "besser konzentrieren",
  a3_begruendung: "Bewegung macht wach",
  a3_beispiel: "müde in Mathe",
  reihenfolge: "1, 2, 3",
  schluss: "Bitte an die Schulkonferenz",
};

const WEAK_PLAN = { thema: "Mittagspause", a1_behauptung: "mehr Zeit zum Essen", a1_begruendung: "Schlange in der Mensa" };

let ctx: ModuleContext;
let db: Db;

beforeEach(async () => {
  vi.stubEnv("DENKRAUM_SHOW_UNAPPROVED", "true");
  ({ ctx, db } = await createTestContext());
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function act(name: string, fields: Record<string, string | string[]> = {}, runId?: string) {
  const result = await ACTIONS[name]!(ctx, form({ ...fields, ...(runId ? { lauf: runId } : {}) }));
  return result ? result.redirect : undefined;
}

async function start(): Promise<string> {
  const redirect = await act("starten", { mission: "m-04-01" });
  const id = /\/lauf\/(.+)$/.exec(redirect ?? "")?.[1];
  expect(id).toBeDefined();
  return id!;
}

async function run(id: string) {
  const row = await findRun(db, ctx.learner.id, id);
  return row!;
}

async function toWriting(id: string) {
  await act("auftrag", {}, id);
  await act("plan", GOOD_PLAN, id);
  await act("planWeiter", {}, id);
  await act("schreiben", {}, id);
}

async function submissions(runId: string, kind: string) {
  return db
    .select()
    .from(uploads)
    .where(and(eq(uploads.ref, runId), eq(uploads.kind, kind)));
}

async function feedbackFor(uploadId: string) {
  return db.select().from(feedback).where(eq(feedback.uploadId, uploadId));
}

describe("mission m-04-01, typed (B1)", () => {
  it("runs from briefing to completed and stores content in the platform tables", async () => {
    const id = await start();
    expect((await run(id)).state).toBe("briefing");

    await act("auftrag", {}, id);
    expect((await run(id)).state).toBe("planning");

    await act("plan", GOOD_PLAN, id);
    let row = await run(id);
    expect(row.state).toBe("plan_feedback");
    expect(row.data.plan.review?.mirror).toMatch(/^So habe ich deinen Plan verstanden:/);
    expect(row.data.plan.review?.criteria.P2).toBe("gruen");

    const [planUpload] = await submissions(id, "plan");
    expect(planUpload).toMatchObject({ typed: true, moduleId: "deutsch-schreibwerkstatt", round: 1, learnerId: ctx.learner.id });
    const [planTranscript] = await db.select().from(transcripts).where(eq(transcripts.uploadId, planUpload!.id));
    expect(planTranscript!.raw).toEqual(planTranscript!.confirmed);
    expect((planTranscript!.confirmed as { standpunkt: string }).standpunkt).toBe(GOOD_PLAN.standpunkt);
    const [planFeedback] = await feedbackFor(planUpload!.id);
    expect(planFeedback).toMatchObject({ kind: "plan_review", promptName: "plan_review", promptVersion: 1, model: "mock" });

    await act("planWeiter", { antwort: "Das Beispiel mit der Mensa." }, id);
    row = await run(id);
    expect(row.state).toBe("plan_approved");
    expect(row.data.plan.answer).toBe("Das Beispiel mit der Mensa.");
    expect(row.data.plan.approvedInRound).toBe(1);

    await act("schreiben", {}, id);
    await act("text", { text: "Ich finde, die Pause sollte länger sein." }, id);
    row = await run(id);
    expect(row.state).toBe("writing");
    expect(row.data.notes).toContain("text_too_short");

    await act("text", { text: SAMPLE_TEXT }, id);
    row = await run(id);
    expect(row.state).toBe("self_check");
    expect(row.data.text.confirmed).toHaveLength(5);
    expect(row.data.text.wordCount).toBeGreaterThanOrEqual(80);
    expect(await submissions(id, "text")).toHaveLength(2);

    await act("selbstkontrolle", { punkt: ["einleitung", "bbb", "erfunden"], these: "1", beispiel: ["4"] }, id);
    row = await run(id);
    expect(row.state).toBe("ai_feedback");
    expect(row.data.selfCheck?.checkedItemIds).toEqual(["einleitung", "bbb"]);
    expect(row.data.selfCheck?.marks[0]).toEqual({ part: "these", quote: "Ich bin der Meinung, dass wir eine längere Mittagspause brauchen." });
    expect(row.data.feedback.quotesVerified).toBe(true);
    expect(row.data.feedback.review?.strengths).toHaveLength(2);
    // D-021: no spelling stars in B1, the maximum is 9.
    expect(row.stars).toMatchObject({ richtigkeit: null, max: 9 });

    await act("ueberarbeiten", {}, id);
    expect((await run(id)).state).toBe("revision");
    await act("ueberarbeitung", { ueberarbeitung: "Aus diesen Gründen bin ich für eine längere Mittagspause. Bitte stimmen Sie dafür, liebe Schulkonferenz." }, id);
    row = await run(id);
    expect(row.state).toBe("completed");
    expect(row.xp).toBe(120);
    expect(row.completedAt).not.toBeNull();
    expect(row.data.notes).not.toContain("revision_unfulfilled");

    const [revisionUpload] = await submissions(id, "revision");
    const [revisionFeedback] = await feedbackFor(revisionUpload!.id);
    expect(revisionFeedback).toMatchObject({ kind: "revision_check", promptVersion: 1 });
    const [lastText] = (await submissions(id, "text")).sort((a, b) => b.round - a.round);
    expect((await feedbackFor(lastText!.id)).map((f) => f.kind)).toEqual(["text_review"]);
  });

  it("ignores events that do not fit the state (double submit)", async () => {
    const id = await start();
    await act("auftrag", {}, id);
    await act("auftrag", {}, id);
    await act("schreiben", {}, id);
    expect((await run(id)).state).toBe("planning");
    expect((await run(id)).version).toBe(1);
  });

  it("sends a weak plan back with hints, at most two rounds", async () => {
    const id = await start();
    await act("auftrag", {}, id);
    await act("plan", WEAK_PLAN, id);
    await act("planWeiter", {}, id);
    let row = await run(id);
    expect(row.state).toBe("plan_revise");
    expect(row.data.plan.gate?.missing).toEqual(["standpunkt", "zwei_argumente_mit_begruendung"]);

    await act("plan", WEAK_PLAN, id);
    await act("planWeiter", {}, id);
    expect((await run(id)).state).toBe("plan_revise");
    await act("plan", WEAK_PLAN, id);
    await act("planWeiter", {}, id);
    row = await run(id);
    expect(row.state).toBe("plan_approved");
    expect(row.data.notes).toContain("plan_approved_after_max_rounds");
    expect((await submissions(id, "plan")).map((u) => u.round).sort()).toEqual([1, 2, 3]);
  });

  it("holds an inappropriate text for an adult and shows no feedback", async () => {
    const id = await start();
    await toWriting(id);
    await act("text", { text: `${SAMPLE_TEXT}\n${MOCK_MARKERS.inappropriate}` }, id);
    await act("selbstkontrolle", {}, id);
    const row = await run(id);
    expect(row.state).toBe("held_for_adult");
    expect(row.data.feedback.review).toBeNull();
    expect(row.stars).toBeNull();
    // The flagged review is kept for the adult view.
    const [textUpload] = await submissions(id, "text");
    const [stored] = await feedbackFor(textUpload!.id);
    expect((stored!.payload as { flags: { inappropriate: boolean } }).flags.inappropriate).toBe(true);
    // Nothing the student does moves the run on.
    await act("ueberarbeiten", {}, id);
    expect((await run(id)).state).toBe("held_for_adult");
  });

  it("asks once more when quotes are not found, then shows the review without marks and a task from code", async () => {
    const id = await start();
    await toWriting(id);
    await act("text", { text: `${SAMPLE_TEXT}\n${MOCK_MARKERS.quoteMismatch}` }, id);
    await act("selbstkontrolle", {}, id);
    const row = await run(id);
    expect(row.state).toBe("ai_feedback");
    expect(row.data.feedback.tries).toBe(2);
    expect(row.data.feedback.quotesVerified).toBe(false);
    expect(row.data.notes).toContain("quotes_unverified");
    const [textUpload] = await submissions(id, "text");
    expect(await feedbackFor(textUpload!.id)).toHaveLength(2);

    await act("ueberarbeiten", {}, id);
    await act("ueberarbeitung", { ueberarbeitung: "Deshalb bitte ich Sie, die Pause zu verlängern, weil wir dann gesünder lernen." }, id);
    const [revision] = await submissions(id, "revision");
    const [content] = await db.select().from(transcripts).where(eq(transcripts.uploadId, revision!.id));
    expect((content!.confirmed as { task: { source: string; instruction: string } }).task).toMatchObject({
      source: "app",
      instruction: APP_REVISION_TASK.instruction,
    });
  });

  it("offers a second revision attempt, then completes with a note", async () => {
    const id = await start();
    await toWriting(id);
    await act("text", { text: SAMPLE_TEXT }, id);
    await act("selbstkontrolle", {}, id);
    await act("ueberarbeiten", {}, id);
    await act("ueberarbeitung", { ueberarbeitung: `Erster Versuch ${MOCK_MARKERS.notFulfilled}` }, id);
    let row = await run(id);
    expect(row.state).toBe("revision");
    expect(row.data.revision.checks[0]?.fulfilled).toBe(false);
    await act("ueberarbeitung", { ueberarbeitung: `Zweiter Versuch ${MOCK_MARKERS.notFulfilled}` }, id);
    row = await run(id);
    expect(row.state).toBe("completed");
    expect(row.data.notes).toContain("revision_unfulfilled");
    expect(row.xp).toBe(120);
  });

  it("does not show or start unapproved missions without the switch (D-022)", async () => {
    vi.stubEnv("DENKRAUM_SHOW_UNAPPROVED", "false");
    expect(await act("starten", { mission: "m-04-01" })).toBe(ctx.basePath);
    expect(await db.select().from(swMissionRuns)).toEqual([]);
  });

  it("deleting the learner removes runs, submissions and feedback (cascade)", async () => {
    const id = await start();
    await toWriting(id);
    await act("text", { text: SAMPLE_TEXT }, id);
    await act("selbstkontrolle", {}, id);
    expect((await db.select().from(feedback)).length).toBeGreaterThan(0);
    await db.delete(learners).where(eq(learners.id, ctx.learner.id));
    expect(await db.select().from(swMissionRuns)).toEqual([]);
    expect(await db.select().from(uploads)).toEqual([]);
    expect(await db.select().from(transcripts)).toEqual([]);
    expect(await db.select().from(feedback)).toEqual([]);
  });

  it("refuses missions that are not part of B1 and runs of other learners", async () => {
    expect(await act("starten", { mission: "m-04-02" })).toBe(ctx.basePath);
    const id = await start();
    const other = { ...ctx, learner: { ...ctx.learner, id: "someone-else" } };
    expect(await ACTIONS.auftrag!(other, form({ lauf: id }))).toEqual({ redirect: ctx.basePath });
    expect((await run(id)).state).toBe("briefing");
  });
});

describe("the mission never waits for the model (D-006, D-014, SW-29)", () => {
  it("goes on when P2, P4 and P5 refuse or fail", async () => {
    const refuse = () => ({ json: null, stopReason: "refusal" });
    ({ ctx, db } = await createTestContext(fixtureProvider({ plan_review: () => "throw", text_review: refuse, revision_check: refuse })));
    const id = await start();
    await act("auftrag", {}, id);
    await act("plan", GOOD_PLAN, id);
    let row = await run(id);
    expect(row.data.plan.reviewUnavailable).toBe("error");
    await act("planWeiter", {}, id);
    await act("schreiben", {}, id);
    await act("text", { text: SAMPLE_TEXT }, id);
    await act("selbstkontrolle", {}, id);
    row = await run(id);
    expect(row.state).toBe("ai_feedback");
    expect(row.data.feedback.unavailable).toBe("refused");
    expect(row.stars).toBeNull();
    await act("ueberarbeiten", {}, id);
    await act("ueberarbeitung", { ueberarbeitung: "Aus diesen Gründen bin ich für eine längere Pause." }, id);
    row = await run(id);
    expect(row.state).toBe("completed");
    expect(row.data.notes).toEqual(
      expect.arrayContaining(["plan_review_unavailable", "text_review_unavailable", "revision_check_unavailable", "ai_refused"]),
    );
    expect(await db.select().from(feedback)).toEqual([]);
  });

  it("treats invalid answers as unavailable after the platform retries", async () => {
    const id = await start();
    await act("auftrag", {}, id);
    await act("plan", { ...GOOD_PLAN, thema: MOCK_MARKERS.noAnswer }, id);
    const row = await run(id);
    expect(row.state).toBe("plan_feedback");
    expect(row.data.plan.reviewUnavailable).toBe("schema_error");
  });

  it("does not send a text that contains the learner's pseudonym; the student still goes on", async () => {
    const id = await start();
    await toWriting(id);
    await act("text", { text: `${SAMPLE_TEXT}\nGeschrieben von ${PSEUDONYM}.` }, id);
    await act("selbstkontrolle", {}, id);
    const row = await run(id);
    expect(row.data.feedback.unavailable).toBe("error");
    await act("ueberarbeiten", {}, id);
    expect((await run(id)).state).toBe("revision");
  });

  it("resumes an interrupted system step", async () => {
    let down = true;
    const provider = fixtureProvider({ plan_review: () => (down ? "throw" : undefined) });
    ({ ctx, db } = await createTestContext(provider));
    const id = await start();
    await act("auftrag", {}, id);
    await act("plan", GOOD_PLAN, id);
    // Simulate a crash between saving the plan and storing the review: the run is pending again.
    const row = await run(id);
    await db
      .update(swMissionRuns)
      .set({ data: { ...row.data, plan: { ...row.data.plan, reviewUnavailable: null } } })
      .where(eq(swMissionRuns.id, id));
    down = false;
    await act("weiter", {}, id);
    expect(provider.calls.filter((c) => c === "plan_review")).toHaveLength(2);
    expect((await run(id)).data.plan.review).not.toBeNull();
  });
});

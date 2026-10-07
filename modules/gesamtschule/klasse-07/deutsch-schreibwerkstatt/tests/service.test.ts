// Services on a real database (PGlite in memory) with the mock model. Synthetic data only.

import { asc, connectDb, eq, schema, type Db } from "@denkraum/db";
import { createMockProvider, loadLlmConfig, type Deps as LlmDeps, type LlmProvider } from "@denkraum/llm";
import { generateAccessCode } from "@denkraum/privacy";
import { beforeAll, describe, expect, it } from "vitest";
import { swMissionEvents, swProgress } from "../db.ts";
import type { MissionEvent } from "../domain/state.ts";
import { transition } from "../domain/state.ts";
import { ghostwritingFindings } from "../domain/summary.ts";
import { textReviewSchema } from "../schemas/textReview.ts";
import { approveAllContent, completeMissionTyped, recordStationPass } from "../server/demo.ts";
import { mockFixtures } from "../server/fixtures.ts";
import { redactIdentity } from "../server/ai.ts";
import { loadRun, runPendingActions, startMission, submitStudentEvent } from "../server/runs.ts";
import type { Learner, ServiceDeps } from "../server/types.ts";
import { identityOf } from "../server/types.ts";
import { missionOverview, missionPage } from "../server/views.ts";
import { TEXT } from "./fixtures.ts";

let db: Db;
const calls: { promptName: string; status: string }[] = [];

function llm(provider: LlmProvider = createMockProvider(mockFixtures)): LlmDeps {
  return {
    provider,
    config: loadLlmConfig({ LLM_PROVIDER: "mock" }),
    onCall: async (record) => {
      calls.push({ promptName: record.promptName, status: record.status });
      await db.insert(schema.llmCalls).values(record);
    },
  };
}

const NOW = new Date("2026-11-04T10:00:00+01:00");
const deps = (): ServiceDeps => ({ db, llm: llm(), now: () => NOW });

async function newLearner(approved = true): Promise<Learner> {
  const [group] = await db
    .insert(schema.groups)
    .values({
      kind: "individual",
      label: "Test",
      schulart: "gesamtschule",
      klasse: 7,
      joinCode: generateAccessCode(),
      endsAt: new Date("2027-07-31"),
    })
    .returning();
  const [learner] = await db
    .insert(schema.learners)
    .values({ groupId: group!.id, pseudonym: "Blauer Falke 42", personalCode: generateAccessCode() })
    .returning();
  if (approved) await approveAllContent(db, group!.id);
  return {
    id: learner!.id,
    groupId: group!.id,
    pseudonym: learner!.pseudonym,
    personalCode: learner!.personalCode,
    joinCode: group!.joinCode,
    niveauEEnabled: false,
  };
}

/** Stages 1 to 3 completed and the station before m-04-01 passed. */
async function readyForStage4(learner: Learner): Promise<void> {
  for (const station of ["st-01-01", "st-01-02", "st-02-01", "st-02-02", "st-03-01", "st-03-02", "st-04-01"]) {
    await recordStationPass(db, learner.id, station, NOW);
  }
  for (const mission of ["m-01-01", "m-01-02", "m-02-01", "m-02-02", "m-03-01", "m-03-02"]) {
    await completeMissionTyped(deps(), learner, mission);
  }
}

const selfCheck = {
  checkedItemIds: ["einleitung"],
  marks: [{ part: "these" as const, quote: "Ich bin der Meinung, dass wir eine längere Mittagspause brauchen." }],
};

const PLAN = {
  thema: "Längere Mittagspause",
  standpunkt: "Ich bin für eine längere Mittagspause.",
  argumente: [
    { behauptung: "mehr Zeit zum Essen", begruendung: "Schlange in der Mensa", beispiel: "gestern nur 10 Minuten" },
    { behauptung: "besser konzentrieren", begruendung: "Bewegung macht wach", beispiel: "nach kurzer Pause müde" },
    { behauptung: "", begruendung: "", beispiel: "" },
  ],
  reihenfolge: "1, 2",
  schluss: "Bitte an die Schulkonferenz",
  legibility: 1,
  uncertain: [],
};

beforeAll(async () => {
  db = await connectDb("pglite:memory");
});

describe("starting a mission", () => {
  it("needs approved content, the stage and the station before it", async () => {
    const fresh = await newLearner(false);
    expect(await startMission(deps(), fresh, "m-01-01")).toMatchObject({ ok: false, blockers: ["not_approved", "station_not_passed"] });

    const learner = await newLearner();
    expect(await startMission(deps(), learner, "m-04-01")).toMatchObject({
      ok: false,
      blockers: ["stage_locked", "station_not_passed"],
    });
    await recordStationPass(db, learner.id, "st-01-01", NOW);
    const started = await startMission(deps(), learner, "m-01-01");
    expect(started).toMatchObject({ ok: true, resumed: false });
    // A second start resumes the open run instead of opening a parallel one.
    expect(await startMission(deps(), learner, "m-01-01")).toEqual({ ok: true, runId: (started as { runId: string }).runId, resumed: true });
    expect(await startMission(deps(), learner, "m-99-99")).toEqual({ ok: false, reason: "unknown_mission" });
  });
});

describe("mission m-04-01, typed", () => {
  it("runs through every state, stores each AI result with prompt version and books rewards once", async () => {
    const learner = await newLearner();
    await readyForStage4(learner);
    const started = await startMission(deps(), learner, "m-04-01");
    if (!started.ok) throw new Error("not startable");
    const runId = started.runId;

    const steps: [MissionEvent, string][] = [
      [{ type: "BRIEFING_ACK" }, "planning"],
      [{ type: "PLAN_TYPED", plan: PLAN }, "plan_feedback"],
      [{ type: "PLAN_FEEDBACK_DONE", answer: "Das stärkste ist die Konzentration." }, "plan_approved"],
      [{ type: "START_WRITING" }, "writing"],
      [{ type: "TEXT_TYPED", paragraphs: TEXT }, "self_check"],
      [{ type: "SELF_CHECK_SUBMITTED", selfCheck }, "ai_feedback"],
      [{ type: "START_REVISION" }, "revision"],
      [{ type: "REVISION_SUBMITTED", text: "Deshalb bitte ich die Schulkonferenz, die Mittagspause zu verlängern." }, "completed"],
    ];
    for (const [event, expected] of steps) {
      const result = await submitStudentEvent(deps(), learner, runId, event);
      if (!result.ok) throw new Error(`${event.type}: ${result.reason} ${result.detail}`);
      expect(result.run.state).toBe(expected);
      expect(result.pending).toBe("idle");
      // Resumable: what the database replays is exactly what the service returned.
      const reloaded = await loadRun(db, learner.id, runId);
      expect(JSON.parse(JSON.stringify(reloaded!.run))).toEqual(JSON.parse(JSON.stringify(result.run)));
    }

    const events = await db.select().from(swMissionEvents).where(eq(swMissionEvents.runId, runId)).orderBy(asc(swMissionEvents.seq));
    const system = events.filter((e) => e.source === "system");
    expect(system.map((e) => [e.type, e.promptName, e.promptVersion, e.model])).toEqual([
      ["PLAN_REVIEWED", "plan_review", 1, "mock"],
      ["TEXT_REVIEWED", "text_review", 1, "mock"],
      ["REVISION_CHECKED", "revision_check", 1, "mock"],
    ]);
    expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i));

    const page = await missionPage(db, learner, runId);
    expect(page!.run.feedback.quotesVerified).toBe(true);
    // Typed where paper is expected: at most 10 stars on stage 4 (spec 6.6).
    expect(page!.run.typedFallback).toBe(true);
    expect(page!.stars).toMatchObject({ base: 8, display: 8, capped: false });
    expect(page!.rewards).toEqual({ xp: 120, keys: 0 });

    // Rewards are idempotent: running the pending steps again books nothing new.
    await runPendingActions(deps(), learner, runId);
    expect((await missionPage(db, learner, runId))!.rewards).toEqual({ xp: 120, keys: 0 });
    const [progress] = await db.select().from(swProgress).where(eq(swProgress.learnerId, learner.id));
    expect(progress!.badges).toContain("planer");
    expect(progress!.lastActiveDay).toBe("2026-11-04");

    const overview = await missionOverview(db, learner);
    const stage4 = overview.stages.find((s) => s.stufe === 4)!;
    expect(stage4.missions.find((m) => m.mission.id === "m-04-01")).toMatchObject({ status: "completed", runId });
  });

  it("resumes an AI step that failed, without losing the child's work", async () => {
    const learner = await newLearner();
    await readyForStage4(learner);
    const started = await startMission(deps(), learner, "m-04-01");
    if (!started.ok) throw new Error("not startable");
    for (const event of [
      { type: "BRIEFING_ACK" },
      { type: "PLAN_TYPED", plan: PLAN },
      { type: "PLAN_FEEDBACK_DONE" },
      { type: "START_WRITING" },
      { type: "TEXT_TYPED", paragraphs: TEXT },
    ] as MissionEvent[]) {
      await submitStudentEvent(deps(), learner, started.runId, event);
    }
    const down: LlmProvider = { name: "down", complete: async () => Promise.reject(new Error("unreachable")) };
    const result = await submitStudentEvent({ db, llm: llm(down), now: () => NOW }, learner, started.runId, {
      type: "SELF_CHECK_SUBMITTED",
      selfCheck,
    });
    expect(result).toMatchObject({ ok: true, pending: "ai_unavailable" });
    expect((await missionPage(db, learner, started.runId))!.pending).toBe("review_text");

    expect(await runPendingActions(deps(), learner, started.runId)).toBe("idle");
    const page = await missionPage(db, learner, started.runId);
    expect(page!.run.feedback.review).not.toBeNull();
    expect(page!.run.selfCheck).toEqual(selfCheck);
  });
});

describe("safety", () => {
  it("holds a text for an adult when the input filter finds something, without calling the model", async () => {
    const learner = await newLearner();
    await recordStationPass(db, learner.id, "st-01-01", NOW);
    const started = await startMission(deps(), learner, "m-01-01");
    if (!started.ok) throw new Error("not startable");
    await submitStudentEvent(deps(), learner, started.runId, { type: "BRIEFING_ACK" });
    await submitStudentEvent(deps(), learner, started.runId, { type: "TEXT_TYPED", paragraphs: ["In der Schule hassen mich alle. Alle hassen mich, weil ich neu bin."] });
    const before = calls.length;
    const result = await submitStudentEvent(deps(), learner, started.runId, {
      type: "SELF_CHECK_SUBMITTED",
      selfCheck: { checkedItemIds: [], marks: [] },
    });
    expect(result).toMatchObject({ ok: true, pending: "held" });
    if (result.ok) expect(result.run.state).toBe("held_for_adult");
    expect(calls.slice(before)).toEqual([]);
  });

  it("refuses system events from the browser", async () => {
    const learner = await newLearner();
    await recordStationPass(db, learner.id, "st-01-01", NOW);
    const started = await startMission(deps(), learner, "m-01-01");
    if (!started.ok) throw new Error("not startable");
    const forged = { type: "REVISION_CHECKED", check: { fulfilled: true, feedback: "Super." } } as MissionEvent;
    expect(await submitStudentEvent(deps(), learner, started.runId, forged)).toEqual({ ok: false, reason: "not_allowed" });
    const other = await newLearner();
    expect(await submitStudentEvent(deps(), other, started.runId, { type: "BRIEFING_ACK" })).toEqual({ ok: false, reason: "not_found" });
  });

  it("removes the child's pseudonym and codes from the model input", () => {
    const identity = identityOf({
      id: "learner-0001",
      groupId: "group-0001",
      pseudonym: "Blauer Falke 42",
      personalCode: "K7QM-X2PA",
      joinCode: "ABCD-EFGH",
      niveauEEnabled: false,
    });
    const input = { text: ["Ich bin blauer falke 42, mein Code ist K7QMX2PA, schreib mir an kind@example.org."] };
    expect(redactIdentity(input, identity)).toEqual({ text: ["Ich bin [entfernt], mein Code ist [entfernt], schreib mir an [entfernt]."] });
  });

  it("produces no feedback that writes text for the child in 10 runs", async () => {
    const learner = await newLearner();
    await readyForStage4(learner);
    for (let i = 0; i < 10; i++) await completeMissionTyped(deps(), learner, "m-04-01");
    const reviews = await db
      .select({ payload: swMissionEvents.payload, runId: swMissionEvents.runId })
      .from(swMissionEvents)
      .where(eq(swMissionEvents.type, "TEXT_REVIEWED"));
    const own = [];
    for (const r of reviews) {
      const loaded = await loadRun(db, learner.id, r.runId);
      if (!loaded || loaded.row.missionId !== "m-04-01") continue;
      const review = textReviewSchema.parse((r.payload as Extract<MissionEvent, { type: "TEXT_REVIEWED" }>).review);
      own.push(ghostwritingFindings(review, loaded.run.text.confirmed ?? []));
    }
    expect(own).toHaveLength(10);
    expect(own.flat()).toEqual([]);
  });
});

describe("state machine stays the gate", () => {
  it("rejects an event that is not allowed in the current state and stores nothing", async () => {
    const learner = await newLearner();
    await recordStationPass(db, learner.id, "st-01-01", NOW);
    const started = await startMission(deps(), learner, "m-01-01");
    if (!started.ok) throw new Error("not startable");
    const result = await submitStudentEvent(deps(), learner, started.runId, { type: "START_REVISION" });
    expect(result).toMatchObject({ ok: false, reason: "rejected" });
    const loaded = await loadRun(db, learner.id, started.runId);
    expect(loaded!.events).toEqual([]);
    expect(transition(loaded!.run, { type: "BRIEFING_ACK" }).ok).toBe(true);
  });
});

// Mission runs on the database: the event log is the source of truth (SW-22), every change
// goes through `transition`, and the system steps (AI calls, filter) are derived from the
// state with `pendingSystemAction`, so a run can always be resumed after a reload.

import { and, asc, eq } from "@denkraum/db";
import type { CallStatus, StructuredResult } from "@denkraum/llm";
import { swMissionEvents, swMissionRuns } from "../db.ts";
import { screenText } from "../domain/filter.ts";
import type { StartBlocker } from "../domain/rules.ts";
import { checkMissionStart } from "../domain/rules.ts";
import type { MissionEvent, MissionRun } from "../domain/state.ts";
import { createRun, pendingSystemAction, replay, transition } from "../domain/state.ts";
import { paragraphsToText, planToText } from "../domain/text.ts";
import type { Stufe } from "../schemas/common.ts";
import type { RevisionCheck } from "../schemas/revisionCheck.ts";
import { checkRevision, reviewPlan, reviewText, type AiContext } from "./ai.ts";
import { contentForGroup, missionById, type Content } from "./content.ts";
import { markActivity, onRunChanged, progressContext } from "./progress.ts";
import { identityOf, nowOf, type Learner, type Queryable, type ServiceDeps } from "./types.ts";

export type RunRow = typeof swMissionRuns.$inferSelect;
export type EventRow = typeof swMissionEvents.$inferSelect;
export type LoadedRun = { row: RunRow; run: MissionRun; events: EventRow[] };

export function parseStufe(value: string): Stufe {
  return value === "boss" ? "boss" : (Number(value) as Stufe);
}

function project(row: RunRow, events: readonly EventRow[]): MissionRun {
  const start = createRun({ missionId: row.missionId, stufe: parseStufe(row.stufe), niveauEEnabled: row.niveauEEnabled });
  const result = replay(
    start,
    events.map((e) => e.payload),
  );
  // Only events that passed `transition` are stored, so a failing replay means a damaged log.
  if (!result.ok) throw new Error(`run ${row.id}: event log does not replay (${result.error.reason})`);
  return result.run;
}

export async function loadRun(q: Queryable, learnerId: string, runId: string): Promise<LoadedRun | null> {
  const [row] = await q
    .select()
    .from(swMissionRuns)
    .where(and(eq(swMissionRuns.id, runId), eq(swMissionRuns.learnerId, learnerId)));
  if (!row) return null;
  const events = await q.select().from(swMissionEvents).where(eq(swMissionEvents.runId, runId)).orderBy(asc(swMissionEvents.seq));
  return { row, run: project(row, events), events };
}

/** All runs of a learner in start order. */
export async function loadRuns(q: Queryable, learnerId: string): Promise<LoadedRun[]> {
  const rows = await q.select().from(swMissionRuns).where(eq(swMissionRuns.learnerId, learnerId)).orderBy(asc(swMissionRuns.startedAt));
  if (rows.length === 0) return [];
  const events = await q
    .select({ event: swMissionEvents })
    .from(swMissionEvents)
    .innerJoin(swMissionRuns, eq(swMissionEvents.runId, swMissionRuns.id))
    .where(eq(swMissionRuns.learnerId, learnerId))
    .orderBy(asc(swMissionEvents.seq));
  const byRun = new Map<string, EventRow[]>();
  for (const { event } of events) byRun.set(event.runId, [...(byRun.get(event.runId) ?? []), event]);
  return rows.map((row) => {
    const own = byRun.get(row.id) ?? [];
    return { row, run: project(row, own), events: own };
  });
}

// ---------------------------------------------------------------------------
// Start

export type StartResult =
  | { ok: true; runId: string; resumed: boolean }
  | { ok: false; reason: "unknown_mission" } | { ok: false; reason: "blocked"; blockers: StartBlocker[] };

/** Starts a mission, or resumes the open run of the same mission instead of opening a second one. */
export async function startMission(deps: ServiceDeps, learner: Learner, missionId: string): Promise<StartResult> {
  const { db } = deps;
  const content = await contentForGroup(db, learner.groupId);
  const mission = missionById(content, missionId);
  if (!mission) return { ok: false, reason: "unknown_mission" };

  const runs = await loadRuns(db, learner.id);
  const open = runs.find((r) => r.row.missionId === missionId && r.run.state !== "completed");
  if (open) return { ok: true, runId: open.row.id, resumed: true };

  const check = checkMissionStart(mission, content.missions, await progressContext(db, learner));
  if (!check.startable) return { ok: false, reason: "blocked", blockers: check.blockers };

  const at = nowOf(deps);
  const [row] = await db
    .insert(swMissionRuns)
    .values({
      learnerId: learner.id,
      missionId,
      stufe: String(mission.stufe),
      niveauEEnabled: learner.niveauEEnabled,
      state: "briefing",
      startedAt: at,
    })
    .returning({ id: swMissionRuns.id });
  await markActivity(db, learner.id, at);
  return { ok: true, runId: row!.id, resumed: false };
}

// ---------------------------------------------------------------------------
// Events

type EventMeta = { source: "student" | "system" | "adult"; promptName?: string; promptVersion?: number; model?: string };

/**
 * Appends one event after `transition` accepted it. The unique (run, seq) index rejects a
 * concurrent second append, so a double submit cannot fork the log.
 */
async function append(deps: ServiceDeps, learner: Learner, loaded: LoadedRun, event: MissionEvent, meta: EventMeta) {
  const result = transition(loaded.run, event);
  if (!result.ok) return result;
  const at = nowOf(deps);
  const next = result.run;
  await deps.db.transaction(async (tx) => {
    await tx.insert(swMissionEvents).values({
      runId: loaded.row.id,
      seq: loaded.events.length,
      type: event.type,
      payload: event,
      source: meta.source,
      promptName: meta.promptName ?? null,
      promptVersion: meta.promptVersion ?? null,
      model: meta.model ?? null,
      createdAt: at,
    });
    const completedNow = loaded.run.state !== "completed" && next.state === "completed";
    await tx
      .update(swMissionRuns)
      .set({ state: next.state, ...(completedNow ? { completedAt: at } : {}) })
      .where(eq(swMissionRuns.id, loaded.row.id));
    if (meta.source !== "system") await markActivity(tx, learner.id, at);
    await onRunChanged(tx, {
      learnerId: learner.id,
      runId: loaded.row.id,
      before: loaded.run,
      after: next,
      allRuns: async () => (await loadRuns(tx, learner.id)).map((r) => r.run),
      at,
    });
  });
  return result;
}

/** Events a student may send. System events (AI results, filter, transcription) never come from the browser. */
export const STUDENT_EVENT_TYPES: ReadonlySet<MissionEvent["type"]> = new Set([
  "BRIEFING_ACK",
  "PLAN_TYPED",
  "PLAN_FEEDBACK_DONE",
  "START_WRITING",
  "TEXT_TYPED",
  "RETAKE_PHOTO",
  "SELF_CHECK_SUBMITTED",
  "START_REVISION",
  "REVISION_SUBMITTED",
]);

export type PendingOutcome = "idle" | "held" | "ai_unavailable" | "waiting";

export type EventResult =
  | { ok: true; run: MissionRun; pending: PendingOutcome }
  | { ok: false; reason: "not_found" | "not_allowed" | "rejected"; detail?: string };

export async function submitStudentEvent(
  deps: ServiceDeps,
  learner: Learner,
  runId: string,
  event: MissionEvent,
): Promise<EventResult> {
  if (!STUDENT_EVENT_TYPES.has(event.type)) return { ok: false, reason: "not_allowed" };
  const loaded = await loadRun(deps.db, learner.id, runId);
  if (!loaded) return { ok: false, reason: "not_found" };
  let result;
  try {
    result = await append(deps, learner, loaded, event, { source: "student" });
  } catch (error) {
    return { ok: false, reason: "rejected", detail: error instanceof Error ? error.message : String(error) };
  }
  if (!result.ok) return { ok: false, reason: "rejected", detail: result.error.reason };
  const pending = await runPendingActions(deps, learner, runId);
  const after = await loadRun(deps.db, learner.id, runId);
  return { ok: true, run: after!.run, pending };
}

// ---------------------------------------------------------------------------
// System steps

/** Shown when P5 refuses: the revision is kept, the mission goes on (SW-38). Written by code, not by a model. */
export const REVISION_NOT_CHECKED: RevisionCheck = {
  fulfilled: false,
  feedback: "Deine Überarbeitung ist gespeichert. Diesmal gibt es keine Rückmeldung dazu.",
};

/** A model result as the event to append, with prompt name, version and model for the log. */
function asEvent<T>(
  result: StructuredResult<T>,
  make: (data: T) => MissionEvent,
): { ok: true; event: MissionEvent; meta: Omit<EventMeta, "source"> } | { ok: false; reason: Exclude<CallStatus, "ok"> } {
  if (!result.ok) return { ok: false, reason: result.reason };
  return {
    ok: true,
    event: make(result.data),
    meta: { promptName: result.promptName, promptVersion: result.promptVersion, model: result.model },
  };
}

const MAX_STEPS = 6;

/**
 * Performs what the state asks for until nothing is pending: input filter, P2, P4 (with one
 * re-request when quotes are not found), P5. Model failures other than a refusal leave the
 * step pending; the page offers "Nochmal versuchen". Transcription (P1, P3) follows in B2.
 */
export async function runPendingActions(deps: ServiceDeps, learner: Learner, runId: string): Promise<PendingOutcome> {
  let content: Content | null = null;
  for (let step = 0; step < MAX_STEPS; step++) {
    const loaded = await loadRun(deps.db, learner.id, runId);
    if (!loaded) return "idle";
    const action = pendingSystemAction(loaded.run);
    if (action === null) return "idle";
    if (action === "notify_adult") return "held";
    if (action === "transcribe_plan" || action === "transcribe_text") return "waiting";

    content ??= await contentForGroup(deps.db, learner.groupId);
    const mission = missionById(content, loaded.run.missionId);
    if (!mission) throw new Error(`unknown mission ${loaded.run.missionId}`);
    const ctx: AiContext = { llm: deps.llm, run: loaded.run, mission, content, identity: identityOf(learner, runId) };
    const system = async (event: MissionEvent, meta: Omit<EventMeta, "source"> = {}) => {
      try {
        await append(deps, learner, loaded, event, { source: "system", ...meta });
      } catch (error) {
        // A parallel request (double tap, second tab) appended first: the next round re-reads the log.
        const now = await loadRun(deps.db, learner.id, runId);
        if (!now || now.events.length === loaded.events.length) throw error;
      }
    };

    if (action === "review_plan" || action === "review_text") {
      const text =
        action === "review_plan" ? planToText(loaded.run.plan.confirmed!) : paragraphsToText(loaded.run.text.confirmed ?? []);
      if (!loaded.run.adultReleased && screenText(text, content.filter).flagged) {
        await system({ type: "CONTENT_FLAGGED" });
        continue;
      }
      const result =
        action === "review_plan"
          ? asEvent(await reviewPlan(ctx), (review) => ({ type: "PLAN_REVIEWED", review }))
          : asEvent(await reviewText(ctx), (review) => ({ type: "TEXT_REVIEWED", review }));
      if (result.ok) {
        await system(result.event, result.meta);
        continue;
      }
      // A refusal goes to an adult instead of another model (D-014, SW-28).
      if (result.reason === "refused" && !loaded.run.adultReleased) {
        await system({ type: "CONTENT_FLAGGED" });
        continue;
      }
      return "ai_unavailable";
    }

    if (action === "check_revision") {
      const result = asEvent(await checkRevision(ctx), (check) => ({ type: "REVISION_CHECKED", check }));
      if (result.ok) {
        await system(result.event, result.meta);
        continue;
      }
      if (result.reason === "refused") {
        await system({ type: "REVISION_CHECKED", check: REVISION_NOT_CHECKED });
        continue;
      }
      return "ai_unavailable";
    }
  }
  return "idle";
}

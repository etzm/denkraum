// Runs a mission: student events and the system actions after them (P2, P4, P5).
//
// - Every state change goes through `transition` (domain/state.ts); nothing sets a state directly.
// - The system action comes from `pendingSystemAction`, so a run interrupted mid-way resumes.
// - A failed or refused model call never blocks: the run gets an *_UNAVAILABLE event and the
//   student goes on (D-006, D-014, SW-29).

import type { ModuleContext } from "@denkraum/sdk";
import type { z } from "zod";
import { revisionTaskFor } from "../domain/feedback.ts";
import { formativeStars, missionXp } from "../domain/rules.ts";
import type { AiFailureReason, MissionEvent, MissionRun } from "../domain/state.ts";
import { pendingSystemAction, promptFlags, transition } from "../domain/state.ts";
import type { Mission } from "../schemas/content.ts";
import { planReviewSchema } from "../schemas/planReview.ts";
import { revisionCheckSchema } from "../schemas/revisionCheck.ts";
import { isFlagged, textReviewSchema } from "../schemas/textReview.ts";
import { planReviewInput, revisionCheckInput, textReviewInput } from "./ai-input.ts";
import type { FeedbackKind, RunRow, SubmissionKind } from "./store.ts";
import { insertFeedback, insertTypedSubmission, latestSubmissionId, saveRun } from "./store.ts";

export type EngineContext = Pick<ModuleContext, "db" | "ai" | "learner" | "manifest" | "now">;

/** Values derived from the run for the row: formative stars (D-020) and XP (SW-07). */
export function derivedValues(run: MissionRun) {
  const review = run.feedback.review;
  const stars =
    review && !isFlagged(review)
      ? // D-021: no error count for typed text in B1, so dimension D is not shown.
        formativeStars({ ai: review, richtigkeit: null, stufe: run.stufe, typedFallback: run.typedFallback })
      : null;
  return { stars, xp: missionXp({ completed: run.state === "completed", revisionsSubmitted: run.revision.texts.length }) };
}

/**
 * Applies one event. `before` runs after the guard passed and before the run is saved, for the
 * content rows. Returns the saved row, or null when the event is not allowed now or the row
 * changed meanwhile (for example a double submit).
 */
export async function commit(
  ctx: EngineContext,
  row: RunRow,
  event: MissionEvent,
  before?: (next: MissionRun) => Promise<void>,
): Promise<RunRow | null> {
  const result = transition(row.data, event);
  if (!result.ok) return null;
  if (before) await before(result.run);
  return saveRun(ctx.db, row, result.run, ctx.now, derivedValues(result.run));
}

/** A typed plan, text or revision as an upload with transcript, then the event. */
export function commitSubmission(
  ctx: EngineContext,
  row: RunRow,
  event: MissionEvent,
  submission: { kind: SubmissionKind; round: (next: MissionRun) => number; content: (next: MissionRun) => unknown },
): Promise<RunRow | null> {
  return commit(ctx, row, event, async (next) => {
    await insertTypedSubmission(ctx.db, {
      learnerId: ctx.learner.id,
      moduleId: ctx.manifest.id,
      kind: submission.kind,
      runId: row.id,
      round: submission.round(next),
      content: submission.content(next),
      now: ctx.now,
    });
  });
}

type AiOutcome<T> =
  | { ok: true; data: T; promptName: string; promptVersion: number; model: string }
  | { ok: false; reason: AiFailureReason };

/** One model call through the platform. Anything thrown (also the identity guard) counts as "error". */
async function ask<T>(
  ctx: EngineContext,
  prompt: string,
  run: MissionRun,
  input: unknown,
  schema: z.ZodType<T>,
): Promise<AiOutcome<T>> {
  try {
    const result = await ctx.ai.generate({ prompt, variables: promptFlags(run), input, schema });
    if (result.ok) return result;
    return { ok: false, reason: result.reason };
  } catch {
    return { ok: false, reason: "error" };
  }
}

async function storeAnswer(
  ctx: EngineContext,
  row: RunRow,
  kind: SubmissionKind,
  feedbackKind: FeedbackKind,
  answer: { data: unknown; promptName: string; promptVersion: number; model: string },
): Promise<void> {
  const uploadId = await latestSubmissionId(ctx.db, { learnerId: ctx.learner.id, moduleId: ctx.manifest.id, runId: row.id, kind });
  if (!uploadId) return;
  await insertFeedback(ctx.db, {
    uploadId,
    kind: feedbackKind,
    promptName: answer.promptName,
    promptVersion: answer.promptVersion,
    model: answer.model,
    payload: answer.data,
    now: ctx.now,
  });
}

async function reviewPlan(ctx: EngineContext, row: RunRow, mission: Mission): Promise<RunRow | null> {
  const answer = await ask(ctx, "plan_review", row.data, planReviewInput(mission, row.data), planReviewSchema);
  if (!answer.ok) return commit(ctx, row, { type: "PLAN_REVIEW_UNAVAILABLE", reason: answer.reason });
  return commit(ctx, row, { type: "PLAN_REVIEWED", review: answer.data }, () => storeAnswer(ctx, row, "plan", "plan_review", answer));
}

async function reviewText(ctx: EngineContext, row: RunRow, mission: Mission): Promise<RunRow | null> {
  const answer = await ask(ctx, "text_review", row.data, textReviewInput(mission, row.data), textReviewSchema);
  if (!answer.ok) return commit(ctx, row, { type: "TEXT_REVIEW_UNAVAILABLE", reason: answer.reason });
  // Stored also when the quote check asks again or the review holds the run (the adult sees it later).
  return commit(ctx, row, { type: "TEXT_REVIEWED", review: answer.data }, () => storeAnswer(ctx, row, "text", "text_review", answer));
}

async function checkRevision(ctx: EngineContext, row: RunRow): Promise<RunRow | null> {
  const task = revisionTaskFor(row.data);
  const revised = row.data.revision.texts.at(-1);
  if (!task || revised === undefined) return commit(ctx, row, { type: "REVISION_CHECK_UNAVAILABLE", reason: "error" });
  const answer = await ask(ctx, "revision_check", row.data, revisionCheckInput(task, revised), revisionCheckSchema);
  if (!answer.ok) return commit(ctx, row, { type: "REVISION_CHECK_UNAVAILABLE", reason: answer.reason });
  return commit(ctx, row, { type: "REVISION_CHECKED", check: answer.data }, () =>
    storeAnswer(ctx, row, "revision", "revision_check", answer),
  );
}

/** Upper bound of model calls per request: two P4 passes (quote check) plus slack. */
const MAX_STEPS = 4;

/**
 * Performs the pending system actions until the run waits for the student again.
 * Transcription (P1, P3) is not part of B1; `notify_adult` waits for the adult view (P2).
 */
export async function runSystemActions(ctx: EngineContext, row: RunRow, mission: Mission): Promise<RunRow> {
  let current = row;
  for (let step = 0; step < MAX_STEPS; step++) {
    const action = pendingSystemAction(current.data);
    let next: RunRow | null;
    if (action === "review_plan") next = await reviewPlan(ctx, current, mission);
    else if (action === "review_text") next = await reviewText(ctx, current, mission);
    else if (action === "check_revision") next = await checkRevision(ctx, current);
    else break;
    // Null: another request changed the run meanwhile and carries on from there.
    if (!next) break;
    current = next;
  }
  return current;
}

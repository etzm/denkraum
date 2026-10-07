// Mission state machine (spec 4) as a pure function `transition(run, event)`.
//
// - A run is plain JSON data, so every state can be stored and resumed.
// - The platform stores every event append-only; the run is a projection of
//   them (`replay`). Nothing a student produced is overwritten (spec 0, SW-22).
// - Illegal events return an error result. Nothing throws.
// - No transition reads stars (SW-01).

import type { Stufe } from "../schemas/common.ts";
import type { PlanReview } from "../schemas/planReview.ts";
import type { PlanTranscript } from "../schemas/planTranscript.ts";
import type { RevisionCheck } from "../schemas/revisionCheck.ts";
import type { SelfCheck } from "../schemas/selfCheck.ts";
import type { TextReview } from "../schemas/textReview.ts";
import type { TextTranscript } from "../schemas/textTranscript.ts";
import { checkReviewQuotes, isExactQuote } from "./quotes.ts";
import type { CompletionFacts, EditCheck, PlanGap, PlanTemplate } from "./rules.ts";
import {
  canUseJoker,
  editDistanceCheck,
  isFullTextStage,
  isMissionCompleted,
  MAX_PLAN_REVISIONS,
  minWordsFor,
  planGate,
} from "./rules.ts";
import { countWords, paragraphsToText, planToText } from "./text.ts";

export const MISSION_STATES = [
  "briefing",
  "planning",
  "plan_uploaded",
  "plan_confirm",
  "plan_feedback",
  "plan_revise",
  "plan_approved",
  "writing",
  "text_uploaded",
  "text_confirm",
  "self_check",
  "ai_feedback",
  "revision",
  "completed",
  "held_for_adult",
] as const;
export type MissionState = (typeof MISSION_STATES)[number];

/** A transcription is retried once, then the keyboard is offered (spec 6.6). */
export const MAX_TRANSCRIPTION_TRIES = 2;
/** A review whose quotes are not found is requested once more, then shown without marks (spec 7.4). */
export const MAX_REVIEW_TRIES = 2;
/** Revision: one retry, then the mission continues with a note (spec 4). */
export const MAX_REVISION_ATTEMPTS = 2;

/**
 * Why a model call gave no usable result (platform `StructuredResult.reason`). The mission
 * never waits for the model: it shows a neutral message and goes on (D-006, D-014, SW-29).
 */
export const AI_FAILURE_REASONS = ["schema_error", "refused", "timeout", "error"] as const;
export type AiFailureReason = (typeof AI_FAILURE_REASONS)[number];

// ---------------------------------------------------------------------------
// Stage variants (spec 4, "Weitere Regeln")

export type StageMedia = {
  /** "none": stages 1 and 5 go from briefing straight to writing. */
  plan: "none" | PlanTemplate;
  text: "keyboard" | "paper";
};

export function stageMedia(stufe: Stufe): StageMedia {
  switch (stufe) {
    case 1:
    case 5:
      return { plan: "none", text: "keyboard" };
    case 2:
      return { plan: "paragraph_template", text: "paper" };
    case 3:
      return { plan: "planning_sheet", text: "keyboard" };
    default:
      // Stage 4, stage 6 and the boss: plan and text on paper.
      return { plan: "planning_sheet", text: "paper" };
  }
}

// ---------------------------------------------------------------------------
// Run data

/** Notes stored with the run ("Vermerke"). They inform adults and later calibration, they gate nothing. */
export type RunNote =
  | "plan_typed"
  | "text_typed"
  | "plan_approved_after_max_rounds"
  | "revision_unfulfilled"
  | "edit_distance_flagged"
  | "transcription_failed"
  | "text_too_short"
  | "quotes_unverified"
  | "held_for_adult"
  /** P2, P4 or P5 gave no usable result; the student went on without it (SW-29). */
  | "plan_review_unavailable"
  | "text_review_unavailable"
  | "revision_check_unavailable"
  /** The model refused at least once; kept for the adult view. */
  | "ai_refused";

export type MissionRun = {
  missionId: string;
  stufe: Stufe;
  /** Snapshot at start; selects the E bonus in prompts and stars. */
  niveauEEnabled: boolean;
  state: MissionState;
  /** The text was typed where paper was expected (spec 6.6, "getippt"). */
  typedFallback: boolean;
  notes: RunNote[];
  plan: {
    /** Plan submissions so far; 1 is the first plan, 2 and 3 are revision rounds. */
    round: number;
    transcriptionFailures: number;
    raw: PlanTranscript | null;
    confirmed: PlanTranscript | null;
    typed: boolean;
    editCheck: EditCheck | null;
    /** P2 result of the current round; null while pending. */
    review: PlanReview | null;
    /** P2 gave no usable result for the current round; the code gate still decides (SW-29). */
    reviewUnavailable: AiFailureReason | null;
    /** Optional answer to the review question (spec 12, question 6). */
    answer: string | null;
    gate: { approved: boolean; missing: PlanGap[] } | null;
    /** Round in which the code gate passed; null if not passed (yet) or approved after max rounds. */
    approvedInRound: number | null;
  };
  text: {
    round: number;
    transcriptionFailures: number;
    raw: TextTranscript | null;
    /** Confirmed transcript or typed text, as paragraphs. */
    confirmed: string[] | null;
    typed: boolean;
    wordCount: number | null;
    editCheck: EditCheck | null;
  };
  selfCheck: SelfCheck | null;
  feedback: {
    /** P4 result shown to the student; null while pending. */
    review: TextReview | null;
    /** First pass, kept when a joker requested a second pass. */
    firstPassReview: TextReview | null;
    /** Reviews received in the current pass (quote check retries). */
    tries: number;
    quotesVerified: boolean | null;
    jokerUsed: boolean;
    /** P4 gave no usable result in the current pass; the revision falls back to a task chosen by code (SW-30). */
    unavailable: AiFailureReason | null;
  };
  revision: {
    /** Submitted revisions, at most two. */
    texts: string[];
    /** P5 results, one per submitted revision once checked; null when P5 gave no usable result (SW-29). */
    checks: (RevisionCheck | null)[];
  };
  /** Set while held for an adult (spec 7.6). No feedback is shown. */
  hold: { from: "plan_feedback" | "ai_feedback"; reason: "input_filter" | "review_flag" } | null;
  /** An adult released the hold for the current content; the content filter is not applied again. */
  adultReleased: boolean;
};

export function createRun(input: { missionId: string; stufe: Stufe; niveauEEnabled: boolean }): MissionRun {
  return {
    missionId: input.missionId,
    stufe: input.stufe,
    niveauEEnabled: input.niveauEEnabled,
    state: "briefing",
    typedFallback: false,
    notes: [],
    plan: {
      round: 0,
      transcriptionFailures: 0,
      raw: null,
      confirmed: null,
      typed: false,
      editCheck: null,
      review: null,
      reviewUnavailable: null,
      answer: null,
      gate: null,
      approvedInRound: null,
    },
    text: { round: 0, transcriptionFailures: 0, raw: null, confirmed: null, typed: false, wordCount: null, editCheck: null },
    selfCheck: null,
    feedback: { review: null, firstPassReview: null, tries: 0, quotesVerified: null, jokerUsed: false, unavailable: null },
    revision: { texts: [], checks: [] },
    hold: null,
    adultReleased: false,
  };
}

// ---------------------------------------------------------------------------
// Events

export type MissionEvent =
  /** "Ich habe den Auftrag verstanden" */
  | { type: "BRIEFING_ACK" }
  /** All pages of the plan photo are uploaded. */
  | { type: "PLAN_UPLOADED" }
  /** Keyboard fallback for the plan (spec 6.6). */
  | { type: "PLAN_TYPED"; plan: PlanTranscript }
  | { type: "PLAN_TRANSCRIBED"; transcript: PlanTranscript }
  /** "Ja, das steht da", with the student's corrections. */
  | { type: "PLAN_CONFIRMED"; plan: PlanTranscript }
  | { type: "PLAN_REVIEWED"; review: PlanReview }
  /** P2 failed or refused; the student sees a neutral message and goes on. */
  | { type: "PLAN_REVIEW_UNAVAILABLE"; reason: AiFailureReason }
  /** The student read the plan feedback, optionally answering the question. */
  | { type: "PLAN_FEEDBACK_DONE"; answer?: string }
  /** "Ich fange an zu schreiben" */
  | { type: "START_WRITING" }
  | { type: "TEXT_UPLOADED" }
  /** Typed text: the normal way on keyboard stages, the fallback on paper stages. */
  | { type: "TEXT_TYPED"; paragraphs: string[] }
  | { type: "TEXT_TRANSCRIBED"; transcript: TextTranscript }
  | { type: "TEXT_CONFIRMED"; paragraphs: string[] }
  /** The transcription call failed (plan or text, whichever is pending). */
  | { type: "TRANSCRIPTION_FAILED" }
  /** The student wants to take the photo again instead of confirming. */
  | { type: "RETAKE_PHOTO" }
  | { type: "SELF_CHECK_SUBMITTED"; selfCheck: SelfCheck }
  /** The content filter before P2 or P4 found inappropriate content (spec 7.6). */
  | { type: "CONTENT_FLAGGED" }
  | { type: "TEXT_REVIEWED"; review: TextReview }
  /** P4 failed or refused; no stars, the revision task comes from code. */
  | { type: "TEXT_REVIEW_UNAVAILABLE"; reason: AiFailureReason }
  /** Second review pass; `keys` is the student's current key balance. */
  | { type: "USE_JOKER"; keys: number }
  /** "Zur Überarbeitung" */
  | { type: "START_REVISION" }
  | { type: "REVISION_SUBMITTED"; text: string }
  | { type: "REVISION_CHECKED"; check: RevisionCheck }
  /** P5 failed or refused; the attempt counts and the mission continues with a note. */
  | { type: "REVISION_CHECK_UNAVAILABLE"; reason: AiFailureReason }
  /** The adult with read access looked at the held content and lets the run continue. */
  | { type: "ADULT_RELEASED" };

export type TransitionError = {
  code: "illegal_transition" | "guard_failed";
  state: MissionState;
  event: MissionEvent["type"];
  reason: string;
};

export type TransitionResult = { ok: true; run: MissionRun } | { ok: false; error: TransitionError };

const ok = (run: MissionRun): TransitionResult => ({ ok: true, run });

function fail(run: MissionRun, event: MissionEvent, code: TransitionError["code"], reason: string): TransitionResult {
  return { ok: false, error: { code, state: run.state, event: event.type, reason } };
}

function addNote(notes: RunNote[], note: RunNote): RunNote[] {
  return notes.includes(note) ? notes : [...notes, note];
}

// ---------------------------------------------------------------------------
// Transition

export function transition(run: MissionRun, event: MissionEvent): TransitionResult {
  const guard = (reason: string) => fail(run, event, "guard_failed", reason);
  const media = stageMedia(run.stufe);

  switch (run.state) {
    case "briefing":
      if (event.type === "BRIEFING_ACK") return ok({ ...run, state: media.plan === "none" ? "writing" : "planning" });
      break;

    case "planning":
    case "plan_revise":
      if (event.type === "PLAN_UPLOADED") {
        return ok({
          ...run,
          state: "plan_uploaded",
          plan: { ...run.plan, round: run.plan.round + 1, transcriptionFailures: 0, raw: null },
        });
      }
      if (event.type === "PLAN_TYPED") {
        return ok(submitPlan({ ...run, plan: { ...run.plan, round: run.plan.round + 1, raw: null } }, event.plan, true, null));
      }
      break;

    case "plan_uploaded":
      if (event.type === "PLAN_TRANSCRIBED") {
        return ok({ ...run, state: "plan_confirm", plan: { ...run.plan, raw: event.transcript } });
      }
      if (event.type === "TRANSCRIPTION_FAILED") {
        const failures = run.plan.transcriptionFailures + 1;
        if (failures < MAX_TRANSCRIPTION_TRIES) return ok({ ...run, plan: { ...run.plan, transcriptionFailures: failures } });
        // Retried once: back to the upload step; the UI offers the keyboard (spec 6.6).
        const back = backToPlanUpload(run);
        return ok({
          ...back,
          notes: addNote(run.notes, "transcription_failed"),
          plan: { ...back.plan, transcriptionFailures: failures },
        });
      }
      break;

    case "plan_confirm":
      if (event.type === "PLAN_CONFIRMED") {
        if (!run.plan.raw) return guard("no raw transcript");
        const check = editDistanceCheck(planToText(run.plan.raw), planToText(event.plan));
        return ok(submitPlan(run, event.plan, false, check));
      }
      if (event.type === "RETAKE_PHOTO") return ok(backToPlanUpload(run));
      break;

    case "plan_feedback": {
      const pending = isPlanReviewPending(run);
      if (event.type === "CONTENT_FLAGGED") {
        if (!pending) return guard("review already shown");
        if (run.adultReleased) return guard("an adult already released this content");
        return ok(hold(run, "plan_feedback", "input_filter"));
      }
      if (event.type === "PLAN_REVIEWED") {
        if (!pending) return guard("review already received");
        return ok({ ...run, plan: { ...run.plan, review: event.review } });
      }
      if (event.type === "PLAN_REVIEW_UNAVAILABLE") {
        if (!pending) return guard("review already received");
        return ok({
          ...run,
          notes: unavailableNotes(run.notes, "plan_review_unavailable", event.reason),
          plan: { ...run.plan, reviewUnavailable: event.reason },
        });
      }
      if (event.type === "PLAN_FEEDBACK_DONE") {
        if (pending) return guard("review still pending");
        if (!run.plan.confirmed || media.plan === "none") return guard("no plan to decide on");
        return ok(decidePlan(run, run.plan.confirmed, media.plan, event.answer));
      }
      break;
    }

    case "plan_approved":
      if (event.type === "START_WRITING") return ok({ ...run, state: "writing" });
      break;

    case "writing":
      if (event.type === "TEXT_UPLOADED") {
        if (media.text !== "paper") return guard("this stage is written with the keyboard");
        return ok({
          ...run,
          state: "text_uploaded",
          text: { ...run.text, round: run.text.round + 1, transcriptionFailures: 0, raw: null },
        });
      }
      if (event.type === "TEXT_TYPED") {
        return ok(submitText({ ...run, text: { ...run.text, round: run.text.round + 1, raw: null } }, event.paragraphs, true, null));
      }
      break;

    case "text_uploaded":
      if (event.type === "TEXT_TRANSCRIBED") {
        return ok({ ...run, state: "text_confirm", text: { ...run.text, raw: event.transcript } });
      }
      if (event.type === "TRANSCRIPTION_FAILED") {
        const failures = run.text.transcriptionFailures + 1;
        if (failures < MAX_TRANSCRIPTION_TRIES) return ok({ ...run, text: { ...run.text, transcriptionFailures: failures } });
        return ok({
          ...run,
          state: "writing",
          notes: addNote(run.notes, "transcription_failed"),
          text: { ...run.text, round: run.text.round - 1, transcriptionFailures: failures },
        });
      }
      break;

    case "text_confirm":
      if (event.type === "TEXT_CONFIRMED") {
        if (!run.text.raw) return guard("no raw transcript");
        const check = editDistanceCheck(paragraphsToText(run.text.raw.paragraphs), paragraphsToText(event.paragraphs));
        return ok(submitText(run, event.paragraphs, false, check));
      }
      if (event.type === "RETAKE_PHOTO") {
        return ok({ ...run, state: "writing", text: { ...run.text, round: run.text.round - 1, raw: null } });
      }
      break;

    case "self_check":
      if (event.type === "SELF_CHECK_SUBMITTED") {
        const source = paragraphsToText(run.text.confirmed ?? []);
        if (!event.selfCheck.marks.every((m) => isExactQuote(m.quote, source))) {
          return guard("marked passages must be part of the confirmed text");
        }
        return ok({
          ...run,
          state: "ai_feedback",
          selfCheck: event.selfCheck,
          feedback: { ...run.feedback, review: null, tries: 0, quotesVerified: null, unavailable: null },
        });
      }
      break;

    case "ai_feedback": {
      const pending = isTextReviewPending(run);
      if (event.type === "CONTENT_FLAGGED") {
        if (!pending) return guard("review already shown");
        if (run.adultReleased) return guard("an adult already released this content");
        return ok(hold(run, "ai_feedback", "input_filter"));
      }
      if (event.type === "TEXT_REVIEWED") {
        if (!pending) return guard("review already received");
        return ok(receiveReview(run, event.review));
      }
      if (event.type === "TEXT_REVIEW_UNAVAILABLE") {
        if (!pending) return guard("review already received");
        return ok({
          ...run,
          notes: unavailableNotes(run.notes, "text_review_unavailable", event.reason),
          feedback: { ...run.feedback, unavailable: event.reason },
        });
      }
      if (event.type === "USE_JOKER") {
        if (pending) return guard("review still pending");
        if (run.feedback.review === null) return guard("no review to repeat");
        if (!canUseJoker({ keys: event.keys, jokerUsed: run.feedback.jokerUsed })) {
          return guard("joker not available: needs 2 keys and at most one per mission");
        }
        return ok({
          ...run,
          feedback: {
            ...run.feedback,
            jokerUsed: true,
            firstPassReview: run.feedback.review,
            review: null,
            tries: 0,
            quotesVerified: null,
            unavailable: null,
          },
        });
      }
      if (event.type === "START_REVISION") {
        if (pending) return guard("review still pending");
        return ok({ ...run, state: "revision" });
      }
      break;
    }

    case "revision": {
      const pendingCheck = run.revision.texts.length > run.revision.checks.length;
      if (event.type === "REVISION_SUBMITTED") {
        if (pendingCheck) return guard("previous revision is still being checked");
        if (run.revision.texts.length >= MAX_REVISION_ATTEMPTS) return guard("no revision attempts left");
        if (event.text.trim() === "") return guard("revision is empty");
        return ok({ ...run, revision: { ...run.revision, texts: [...run.revision.texts, event.text] } });
      }
      if (event.type === "REVISION_CHECKED") {
        if (!pendingCheck) return guard("no revision waiting for a check");
        const next = { ...run, revision: { ...run.revision, checks: [...run.revision.checks, event.check] } };
        if (!isMissionCompleted(completionFacts(next))) return ok(next);
        const notes = event.check.fulfilled ? next.notes : addNote(next.notes, "revision_unfulfilled");
        return ok({ ...next, state: "completed", notes });
      }
      if (event.type === "REVISION_CHECK_UNAVAILABLE") {
        if (!pendingCheck) return guard("no revision waiting for a check");
        const next = {
          ...run,
          notes: unavailableNotes(run.notes, "revision_check_unavailable", event.reason),
          revision: { ...run.revision, checks: [...run.revision.checks, null] },
        };
        // Without a check the attempt counts as done: completion never waits for the model (SW-29).
        return ok(isMissionCompleted(completionFacts(next)) ? { ...next, state: "completed" } : next);
      }
      break;
    }

    case "held_for_adult":
      if (event.type === "ADULT_RELEASED") {
        if (!run.hold) return guard("no hold");
        return ok({ ...run, state: run.hold.from, hold: null, adultReleased: true });
      }
      break;

    case "completed":
      break;
  }
  return fail(run, event, "illegal_transition", `${event.type} is not allowed in ${run.state}`);
}

/** Applies events in order and stops at the first error. */
export function replay(run: MissionRun, events: readonly MissionEvent[]): TransitionResult {
  let result: TransitionResult = ok(run);
  for (const event of events) {
    if (!result.ok) break;
    result = transition(result.run, event);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Helpers

function backToPlanUpload(run: MissionRun): MissionRun {
  const round = run.plan.round - 1;
  return { ...run, state: round === 0 ? "planning" : "plan_revise", plan: { ...run.plan, round, raw: null } };
}

/** P2 not received and not given up on. */
export function isPlanReviewPending(run: MissionRun): boolean {
  return run.plan.review === null && run.plan.reviewUnavailable === null;
}

/** P4 not received and not given up on. */
export function isTextReviewPending(run: MissionRun): boolean {
  return run.feedback.review === null && run.feedback.unavailable === null;
}

function unavailableNotes(notes: RunNote[], note: RunNote, reason: AiFailureReason): RunNote[] {
  const withNote = addNote(notes, note);
  return reason === "refused" ? addNote(withNote, "ai_refused") : withNote;
}

function submitPlan(run: MissionRun, plan: PlanTranscript, typed: boolean, editCheck: EditCheck | null): MissionRun {
  let notes = run.notes;
  if (typed) notes = addNote(notes, "plan_typed");
  if (editCheck?.flagged) notes = addNote(notes, "edit_distance_flagged");
  return {
    ...run,
    state: "plan_feedback",
    notes,
    adultReleased: false,
    plan: { ...run.plan, confirmed: plan, typed, editCheck, review: null, reviewUnavailable: null, answer: null, gate: null },
  };
}

function decidePlan(run: MissionRun, plan: PlanTranscript, template: PlanTemplate, answer: string | undefined): MissionRun {
  const gate = planGate(plan, template);
  const decided = { ...run.plan, answer: answer ?? null, gate };
  if (gate.approved) {
    return { ...run, state: "plan_approved", plan: { ...decided, approvedInRound: run.plan.round } };
  }
  if (run.plan.round <= MAX_PLAN_REVISIONS) return { ...run, state: "plan_revise", plan: decided };
  return {
    ...run,
    state: "plan_approved",
    plan: decided,
    notes: addNote(run.notes, "plan_approved_after_max_rounds"),
  };
}

function submitText(run: MissionRun, paragraphs: string[], typed: boolean, editCheck: EditCheck | null): MissionRun {
  const fallback = typed && stageMedia(run.stufe).text === "paper";
  const wordCount = countWords(paragraphsToText(paragraphs));
  const tooShort = wordCount < minWordsFor(run.stufe);
  let notes = run.notes;
  if (fallback) notes = addNote(notes, "text_typed");
  if (editCheck?.flagged) notes = addNote(notes, "edit_distance_flagged");
  if (tooShort) notes = addNote(notes, "text_too_short");
  return {
    ...run,
    // Too short: back to writing, the student completes the text (spec 7.1). Checked by code, not by the model.
    state: tooShort ? "writing" : "self_check",
    typedFallback: fallback,
    notes,
    adultReleased: false,
    text: { ...run.text, confirmed: paragraphs, typed, wordCount, editCheck },
  };
}

function receiveReview(run: MissionRun, review: TextReview): MissionRun {
  const tries = run.feedback.tries + 1;
  if (review.flags.inappropriate && !run.adultReleased) {
    // The review is not stored in the run and never shown; the event log keeps it for the adult.
    return hold({ ...run, feedback: { ...run.feedback, tries: 0 } }, "ai_feedback", "review_flag");
  }
  const quotes = checkReviewQuotes(review, run.text.confirmed ?? []);
  if (!quotes.ok && tries < MAX_REVIEW_TRIES) {
    // Stays pending; the system requests the review once more.
    return { ...run, feedback: { ...run.feedback, tries } };
  }
  return {
    ...run,
    notes: quotes.ok ? run.notes : addNote(run.notes, "quotes_unverified"),
    feedback: { ...run.feedback, tries, review, quotesVerified: quotes.ok },
  };
}

function hold(run: MissionRun, from: "plan_feedback" | "ai_feedback", reason: "input_filter" | "review_flag"): MissionRun {
  return { ...run, state: "held_for_adult", hold: { from, reason }, notes: addNote(run.notes, "held_for_adult") };
}

/** Facts for `isMissionCompleted`, read from a run. */
export function completionFacts(run: MissionRun): CompletionFacts {
  const lastCheck = run.revision.checks.at(-1);
  return {
    textConfirmed: run.text.confirmed !== null,
    wordCount: run.text.wordCount ?? 0,
    minWords: minWordsFor(run.stufe),
    selfCheckSubmitted: run.selfCheck !== null,
    // Checked attempts: the student sees the feedback on the second attempt before the mission completes.
    revisionAttempts: run.revision.checks.length,
    revisionFulfilled: lastCheck ? lastCheck.fulfilled : null,
    revisionUnchecked: lastCheck === null,
  };
}

/** Values for the `{{#if flag}}` blocks of the prompt files. */
export type PromptFlags = { paragraph_template: boolean; full_text: boolean; niveau_e_enabled: boolean };

export function promptFlags(run: Pick<MissionRun, "stufe" | "niveauEEnabled">): PromptFlags {
  return {
    paragraph_template: stageMedia(run.stufe).plan === "paragraph_template",
    full_text: isFullTextStage(run.stufe),
    niveau_e_enabled: run.niveauEEnabled,
  };
}

export type SystemAction =
  | "transcribe_plan"
  /** Runs the content filter first, unless an adult released the content. */
  | "review_plan"
  | "transcribe_text"
  | "review_text"
  | "check_revision"
  | "notify_adult";

/** What the system has to do in the current state. Derived from data, so it survives a restart. */
export function pendingSystemAction(run: MissionRun): SystemAction | null {
  switch (run.state) {
    case "plan_uploaded":
      return "transcribe_plan";
    case "plan_feedback":
      return isPlanReviewPending(run) ? "review_plan" : null;
    case "text_uploaded":
      return "transcribe_text";
    case "ai_feedback":
      return isTextReviewPending(run) ? "review_text" : null;
    case "revision":
      return run.revision.texts.length > run.revision.checks.length ? "check_revision" : null;
    case "held_for_adult":
      return "notify_adult";
    default:
      return null;
  }
}

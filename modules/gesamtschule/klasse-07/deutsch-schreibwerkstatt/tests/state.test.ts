import { describe, expect, it } from "vitest";
import type { MissionEvent, MissionRun, TransitionResult } from "../domain/state.ts";
import { createRun, pendingSystemAction, replay, stageMedia, transition } from "../domain/state.ts";
import type { Stufe } from "../schemas/common.ts";
import type { SelfCheck } from "../schemas/selfCheck.ts";
import {
  FULFILLED,
  makeParagraphPlan,
  makePlan,
  makePlanReview,
  makeTextReview,
  makeTextTranscript,
  makeWeakPlan,
  NOT_FULFILLED,
  TEXT,
} from "./fixtures.ts";

const selfCheck: SelfCheck = {
  checkedItemIds: ["einleitung", "bbb"],
  marks: [{ part: "these", quote: "Ich bin der Meinung, dass wir eine längere Mittagspause brauchen." }],
};

function start(stufe: Stufe, niveauEEnabled = false): MissionRun {
  return createRun({ missionId: "m-test", stufe, niveauEEnabled });
}

/** Applies events and fails the test on the first error. */
function run(from: MissionRun, events: MissionEvent[]): MissionRun {
  const result = replay(from, events);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.reason}`);
  return result.run;
}

function expectError(result: TransitionResult, code: "illegal_transition" | "guard_failed"): void {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.code).toBe(code);
}

const PAPER_PLAN: MissionEvent[] = [
  { type: "BRIEFING_ACK" },
  { type: "PLAN_UPLOADED" },
  { type: "PLAN_TRANSCRIBED", transcript: makePlan() },
  { type: "PLAN_CONFIRMED", plan: makePlan() },
  { type: "PLAN_REVIEWED", review: makePlanReview() },
  { type: "PLAN_FEEDBACK_DONE", answer: "Das Beispiel mit der Mensa." },
  { type: "START_WRITING" },
];

const PAPER_TEXT: MissionEvent[] = [
  { type: "TEXT_UPLOADED" },
  { type: "TEXT_TRANSCRIBED", transcript: makeTextTranscript() },
  { type: "TEXT_CONFIRMED", paragraphs: TEXT },
];

const FEEDBACK_AND_REVISION: MissionEvent[] = [
  { type: "SELF_CHECK_SUBMITTED", selfCheck },
  { type: "TEXT_REVIEWED", review: makeTextReview() },
  { type: "START_REVISION" },
  { type: "REVISION_SUBMITTED", text: "Aus diesen Gründen bin ich für eine längere Mittagspause." },
  { type: "REVISION_CHECKED", check: FULFILLED },
];

describe("stage 4 happy path", () => {
  it("walks through every state of spec 4", () => {
    const events = [...PAPER_PLAN, ...PAPER_TEXT, ...FEEDBACK_AND_REVISION];
    const expected = [
      "planning",
      "plan_uploaded",
      "plan_confirm",
      "plan_feedback",
      "plan_feedback",
      "plan_approved",
      "writing",
      "text_uploaded",
      "text_confirm",
      "self_check",
      "ai_feedback",
      "ai_feedback",
      "revision",
      "revision",
      "completed",
    ];
    let current = start(4);
    expect(current.state).toBe("briefing");
    const seen: string[] = [];
    for (const event of events) {
      const result = transition(current, event);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      current = result.run;
      seen.push(current.state);
    }
    expect(seen).toEqual(expected);
    expect(current.plan.approvedInRound).toBe(1);
    expect(current.plan.answer).toBe("Das Beispiel mit der Mensa.");
    expect(current.text.wordCount).toBe(97);
    expect(current.typedFallback).toBe(false);
    expect(current.notes).toEqual([]);
  });

  it("tells the system what to do in each waiting state", () => {
    let r = run(start(4), [{ type: "BRIEFING_ACK" }, { type: "PLAN_UPLOADED" }]);
    expect(pendingSystemAction(r)).toBe("transcribe_plan");
    r = run(r, [{ type: "PLAN_TRANSCRIBED", transcript: makePlan() }]);
    expect(pendingSystemAction(r)).toBeNull();
    r = run(r, [{ type: "PLAN_CONFIRMED", plan: makePlan() }]);
    expect(pendingSystemAction(r)).toBe("review_plan");
    r = run(r, [...PAPER_PLAN.slice(4), { type: "TEXT_UPLOADED" }]);
    expect(pendingSystemAction(r)).toBe("transcribe_text");
    r = run(r, [...PAPER_TEXT.slice(1), { type: "SELF_CHECK_SUBMITTED", selfCheck }]);
    expect(pendingSystemAction(r)).toBe("review_text");
    r = run(r, [
      { type: "TEXT_REVIEWED", review: makeTextReview() },
      { type: "START_REVISION" },
      { type: "REVISION_SUBMITTED", text: "Neu." },
    ]);
    expect(pendingSystemAction(r)).toBe("check_revision");
  });

  it("is plain data: a run survives JSON and resumes in every state", () => {
    const events = [...PAPER_PLAN, ...PAPER_TEXT, ...FEEDBACK_AND_REVISION];
    for (let i = 0; i < events.length; i++) {
      const before = run(start(4), events.slice(0, i));
      const stored = JSON.parse(JSON.stringify(before)) as MissionRun;
      expect(stored).toEqual(before);
      expect(run(stored, events.slice(i))).toEqual(run(before, events.slice(i)));
    }
  });
});

describe("stage variants", () => {
  it("stages 1 and 5 skip the plan phase and are typed", () => {
    for (const stufe of [1, 5] as const) {
      const writing = run(start(stufe), [{ type: "BRIEFING_ACK" }]);
      expect(writing.state).toBe("writing");
      expectError(transition(writing, { type: "PLAN_UPLOADED" }), "illegal_transition");
      expectError(transition(writing, { type: "TEXT_UPLOADED" }), "guard_failed");
      const typed = run(writing, [{ type: "TEXT_TYPED", paragraphs: TEXT }]);
      expect(typed.state).toBe("self_check");
      expect(typed.typedFallback).toBe(false);
      expect(run(typed, FEEDBACK_AND_REVISION).state).toBe("completed");
    }
  });

  it("stage 2 plans on the paragraph template and writes on paper", () => {
    expect(stageMedia(2)).toEqual({ plan: "paragraph_template", text: "paper" });
    const r = run(start(2), [
      { type: "BRIEFING_ACK" },
      { type: "PLAN_UPLOADED" },
      { type: "PLAN_TRANSCRIBED", transcript: makeParagraphPlan() },
      { type: "PLAN_CONFIRMED", plan: makeParagraphPlan() },
      { type: "PLAN_REVIEWED", review: makePlanReview() },
      { type: "PLAN_FEEDBACK_DONE" },
    ]);
    expect(r.state).toBe("plan_approved");
    const paragraph = ["Ein Haustier bringt uns bei, Verantwortung zu übernehmen, weil jemand jeden Tag füttern muss."];
    const done = run(r, [
      { type: "START_WRITING" },
      { type: "TEXT_UPLOADED" },
      { type: "TEXT_TRANSCRIBED", transcript: makeTextTranscript(paragraph) },
      { type: "TEXT_CONFIRMED", paragraphs: paragraph },
    ]);
    expect(done.state).toBe("self_check");
  });

  it("stage 3 plans on paper and types the text", () => {
    const writing = run(start(3), PAPER_PLAN);
    expect(writing.state).toBe("writing");
    expectError(transition(writing, { type: "TEXT_UPLOADED" }), "guard_failed");
    const typed = run(writing, [{ type: "TEXT_TYPED", paragraphs: TEXT }]);
    expect(typed.state).toBe("self_check");
    expect(typed.typedFallback).toBe(false);
  });

  it("from stage 4 on, typing is the fallback and is noted", () => {
    for (const stufe of [4, 6, "boss"] as const) {
      expect(stageMedia(stufe)).toEqual({ plan: "planning_sheet", text: "paper" });
      const typed = run(start(stufe), [...PAPER_PLAN, { type: "TEXT_TYPED", paragraphs: TEXT }]);
      expect(typed.state).toBe("self_check");
      expect(typed.typedFallback).toBe(true);
      expect(typed.notes).toContain("text_typed");
    }
  });

  it("accepts a typed plan as fallback", () => {
    const r = run(start(4), [{ type: "BRIEFING_ACK" }, { type: "PLAN_TYPED", plan: makePlan() }]);
    expect(r.state).toBe("plan_feedback");
    expect(r.plan.round).toBe(1);
    expect(r.notes).toContain("plan_typed");
  });
});

describe("plan revision", () => {
  const weakRound = (review = makePlanReview({ approved: false })): MissionEvent[] => [
    { type: "PLAN_UPLOADED" },
    { type: "PLAN_TRANSCRIBED", transcript: makeWeakPlan() },
    { type: "PLAN_CONFIRMED", plan: makeWeakPlan() },
    { type: "PLAN_REVIEWED", review },
    { type: "PLAN_FEEDBACK_DONE" },
  ];

  it("allows at most two revision rounds, then approves with a note", () => {
    let r = run(start(4), [{ type: "BRIEFING_ACK" }, ...weakRound()]);
    expect(r.state).toBe("plan_revise");
    expect(r.plan.gate?.missing).toEqual(["standpunkt", "zwei_argumente_mit_begruendung"]);
    r = run(r, weakRound());
    expect(r.state).toBe("plan_revise");
    expect(r.plan.round).toBe(2);
    r = run(r, weakRound());
    expect(r.state).toBe("plan_approved");
    expect(r.plan.round).toBe(3);
    expect(r.plan.approvedInRound).toBeNull();
    expect(r.notes).toContain("plan_approved_after_max_rounds");
  });

  it("approves a revised plan in round 2", () => {
    const r = run(start(4), [
      { type: "BRIEFING_ACK" },
      ...weakRound(),
      { type: "PLAN_UPLOADED" },
      { type: "PLAN_TRANSCRIBED", transcript: makePlan() },
      { type: "PLAN_CONFIRMED", plan: makePlan() },
      { type: "PLAN_REVIEWED", review: makePlanReview() },
      { type: "PLAN_FEEDBACK_DONE" },
    ]);
    expect(r.state).toBe("plan_approved");
    expect(r.plan.approvedInRound).toBe(2);
  });

  it("decides by the code gate, not by the model's approved flag", () => {
    const strongButRejected = run(start(4), [
      { type: "BRIEFING_ACK" },
      { type: "PLAN_TYPED", plan: makePlan() },
      { type: "PLAN_REVIEWED", review: makePlanReview({ approved: false }) },
      { type: "PLAN_FEEDBACK_DONE" },
    ]);
    expect(strongButRejected.state).toBe("plan_approved");
    const weakButApproved = run(start(4), [
      { type: "BRIEFING_ACK" },
      { type: "PLAN_TYPED", plan: makeWeakPlan() },
      { type: "PLAN_REVIEWED", review: makePlanReview({ approved: true }) },
      { type: "PLAN_FEEDBACK_DONE" },
    ]);
    expect(weakButApproved.state).toBe("plan_revise");
  });
});

describe("revision", () => {
  const atRevision = () => run(start(4), [...PAPER_PLAN, ...PAPER_TEXT, ...FEEDBACK_AND_REVISION.slice(0, 3)]);

  it("offers one retry, then continues with a note", () => {
    let r = run(atRevision(), [
      { type: "REVISION_SUBMITTED", text: "Erster Versuch." },
      { type: "REVISION_CHECKED", check: NOT_FULFILLED },
    ]);
    expect(r.state).toBe("revision");
    expect(pendingSystemAction(r)).toBeNull();
    r = run(r, [
      { type: "REVISION_SUBMITTED", text: "Zweiter Versuch." },
      { type: "REVISION_CHECKED", check: NOT_FULFILLED },
    ]);
    expect(r.state).toBe("completed");
    expect(r.notes).toContain("revision_unfulfilled");
    expect(r.revision.texts).toEqual(["Erster Versuch.", "Zweiter Versuch."]);
    expectError(transition(r, { type: "REVISION_SUBMITTED", text: "Dritter." }), "illegal_transition");
  });

  it("completes after a fulfilled second attempt without a note", () => {
    const r = run(atRevision(), [
      { type: "REVISION_SUBMITTED", text: "Erster Versuch." },
      { type: "REVISION_CHECKED", check: NOT_FULFILLED },
      { type: "REVISION_SUBMITTED", text: "Zweiter Versuch." },
      { type: "REVISION_CHECKED", check: FULFILLED },
    ]);
    expect(r.state).toBe("completed");
    expect(r.notes).not.toContain("revision_unfulfilled");
  });

  it("rejects empty or overlapping submissions", () => {
    const r = atRevision();
    expectError(transition(r, { type: "REVISION_SUBMITTED", text: "  " }), "guard_failed");
    expectError(transition(r, { type: "REVISION_CHECKED", check: FULFILLED }), "guard_failed");
    const pending = run(r, [{ type: "REVISION_SUBMITTED", text: "Neu." }]);
    expectError(transition(pending, { type: "REVISION_SUBMITTED", text: "Noch neuer." }), "guard_failed");
  });
});

describe("stars never gate", () => {
  it("a zero-star review and a full-star review complete the same way", () => {
    const withScores = (n: 0 | 3) =>
      run(start(4), [
        ...PAPER_PLAN,
        ...PAPER_TEXT,
        { type: "SELF_CHECK_SUBMITTED", selfCheck },
        {
          type: "TEXT_REVIEWED",
          review: makeTextReview({
            scores: { aufbau: n, argumentation: n, sprache: n, richtigkeit: n },
            error_density: n === 0 ? 20 : 0,
          }),
        },
        ...FEEDBACK_AND_REVISION.slice(2),
      ]);
    const zero = withScores(0);
    const full = withScores(3);
    expect(zero.state).toBe("completed");
    expect(full.state).toBe("completed");
    expect({ ...zero, feedback: null }).toEqual({ ...full, feedback: null });
  });
});

describe("held_for_adult", () => {
  const atFeedback = () => run(start(4), [...PAPER_PLAN, ...PAPER_TEXT, { type: "SELF_CHECK_SUBMITTED", selfCheck }]);
  const flagged = makeTextReview({ flags: { too_short: false, off_topic: false, inappropriate: true } });

  it("holds an inappropriate review: no feedback shown, adult notified", () => {
    const held = run(atFeedback(), [{ type: "TEXT_REVIEWED", review: flagged }]);
    expect(held.state).toBe("held_for_adult");
    expect(held.feedback.review).toBeNull();
    expect(held.hold).toEqual({ from: "ai_feedback", reason: "review_flag" });
    expect(pendingSystemAction(held)).toBe("notify_adult");
    expectError(transition(held, { type: "START_REVISION" }), "illegal_transition");
  });

  it("continues only after an adult released the run", () => {
    const held = run(atFeedback(), [{ type: "TEXT_REVIEWED", review: flagged }]);
    const released = run(held, [{ type: "ADULT_RELEASED" }]);
    expect(released.state).toBe("ai_feedback");
    expect(pendingSystemAction(released)).toBe("review_text");
    expectError(transition(released, { type: "CONTENT_FLAGGED" }), "guard_failed");
    const shown = run(released, [{ type: "TEXT_REVIEWED", review: flagged }]);
    expect(shown.state).toBe("ai_feedback");
    expect(shown.feedback.review).not.toBeNull();
  });

  it("holds when the content filter flags a plan before P2", () => {
    const atPlanFeedback = run(start(4), PAPER_PLAN.slice(0, 4));
    const held = run(atPlanFeedback, [{ type: "CONTENT_FLAGGED" }]);
    expect(held.state).toBe("held_for_adult");
    expect(held.hold).toEqual({ from: "plan_feedback", reason: "input_filter" });
    const released = run(held, [{ type: "ADULT_RELEASED" }]);
    expect(released.state).toBe("plan_feedback");
    expect(pendingSystemAction(released)).toBe("review_plan");
  });

  it("filters new content again after a release", () => {
    const released = run(start(4), [...PAPER_PLAN.slice(0, 4), { type: "CONTENT_FLAGGED" }, { type: "ADULT_RELEASED" }]);
    const next = run(released, [...PAPER_PLAN.slice(4), ...PAPER_TEXT, { type: "SELF_CHECK_SUBMITTED", selfCheck }]);
    expect(next.adultReleased).toBe(false);
    expect(run(next, [{ type: "CONTENT_FLAGGED" }]).state).toBe("held_for_adult");
  });
});

describe("transcription", () => {
  it("retries once, then goes back to the upload step with a note", () => {
    let r = run(start(4), [{ type: "BRIEFING_ACK" }, { type: "PLAN_UPLOADED" }, { type: "TRANSCRIPTION_FAILED" }]);
    expect(r.state).toBe("plan_uploaded");
    r = run(r, [{ type: "TRANSCRIPTION_FAILED" }]);
    expect(r.state).toBe("planning");
    expect(r.plan.round).toBe(0);
    expect(r.notes).toContain("transcription_failed");

    let t = run(start(4), [...PAPER_PLAN, { type: "TEXT_UPLOADED" }, { type: "TRANSCRIPTION_FAILED" }]);
    expect(t.state).toBe("text_uploaded");
    t = run(t, [{ type: "TRANSCRIPTION_FAILED" }]);
    expect(t.state).toBe("writing");
    expect(run(t, [{ type: "TEXT_TYPED", paragraphs: TEXT }]).typedFallback).toBe(true);
  });

  it("lets the student retake a photo instead of confirming", () => {
    const r = run(start(4), [
      { type: "BRIEFING_ACK" },
      { type: "PLAN_UPLOADED" },
      { type: "PLAN_TRANSCRIBED", transcript: makePlan({ legibility: 0.3 }) },
      { type: "RETAKE_PHOTO" },
    ]);
    expect(r.state).toBe("planning");
    expect(r.plan.round).toBe(0);
    expect(r.plan.raw).toBeNull();
  });

  it("only logs a large edit distance, the mission goes on", () => {
    const r = run(start(4), [
      ...PAPER_PLAN,
      { type: "TEXT_UPLOADED" },
      { type: "TEXT_TRANSCRIBED", transcript: makeTextTranscript(["[?] [?] [?] Mittagspause [?]"]) },
      { type: "TEXT_CONFIRMED", paragraphs: TEXT },
    ]);
    expect(r.state).toBe("self_check");
    expect(r.text.editCheck?.flagged).toBe(true);
    expect(r.notes).toContain("edit_distance_flagged");
  });

  it("sends a text under 80 words back to writing (code check)", () => {
    const short = ["Ich bin für eine längere Mittagspause, weil wir mehr Zeit zum Essen brauchen."];
    const r = run(start(4), [
      ...PAPER_PLAN,
      { type: "TEXT_UPLOADED" },
      { type: "TEXT_TRANSCRIBED", transcript: makeTextTranscript(short) },
      { type: "TEXT_CONFIRMED", paragraphs: short },
    ]);
    expect(r.state).toBe("writing");
    expect(r.text.confirmed).toEqual(short);
    expect(r.notes).toContain("text_too_short");
    expect(run(r, [{ type: "TEXT_UPLOADED" }]).text.round).toBe(2);
  });
});

describe("text review", () => {
  const atFeedback = () => run(start(4), [...PAPER_PLAN, ...PAPER_TEXT, { type: "SELF_CHECK_SUBMITTED", selfCheck }]);
  const badQuote = makeTextReview({
    revision_task: { instruction: "Nenne deinen Standpunkt.", target_quote: "Das steht nicht im Text.", help_card_id: "HK-06" },
  });

  it("requests the review once more when a quote is not found, then shows it without marks", () => {
    let r = run(atFeedback(), [{ type: "TEXT_REVIEWED", review: badQuote }]);
    expect(r.feedback.review).toBeNull();
    expect(pendingSystemAction(r)).toBe("review_text");
    r = run(r, [{ type: "TEXT_REVIEWED", review: badQuote }]);
    expect(r.feedback.review).not.toBeNull();
    expect(r.feedback.quotesVerified).toBe(false);
    expect(r.notes).toContain("quotes_unverified");
    expect(run(r, [{ type: "START_REVISION" }]).state).toBe("revision");
  });

  it("joker: one second pass for 2 keys, the first pass is kept", () => {
    const shown = run(atFeedback(), [{ type: "TEXT_REVIEWED", review: makeTextReview() }]);
    expectError(transition(shown, { type: "USE_JOKER", keys: 1 }), "guard_failed");
    const second = run(shown, [{ type: "USE_JOKER", keys: 2 }]);
    expect(second.feedback.review).toBeNull();
    expect(second.feedback.firstPassReview).toEqual(makeTextReview());
    expect(pendingSystemAction(second)).toBe("review_text");
    const after = run(second, [{ type: "TEXT_REVIEWED", review: makeTextReview() }]);
    expectError(transition(after, { type: "USE_JOKER", keys: 5 }), "guard_failed");
  });

  it("rejects self check marks that are not in the text", () => {
    const r = run(start(4), [...PAPER_PLAN, ...PAPER_TEXT]);
    const wrong: SelfCheck = { checkedItemIds: [], marks: [{ part: "beispiel", quote: "Erfunden." }] };
    expectError(transition(r, { type: "SELF_CHECK_SUBMITTED", selfCheck: wrong }), "guard_failed");
  });
});

describe("illegal transitions", () => {
  it("return an error result with state and event, never throw", () => {
    const result = transition(start(4), { type: "START_WRITING" });
    expect(result).toEqual({
      ok: false,
      error: {
        code: "illegal_transition",
        state: "briefing",
        event: "START_WRITING",
        reason: "START_WRITING is not allowed in briefing",
      },
    });
  });

  it("guards events that come too early", () => {
    const atPlanFeedback = run(start(4), PAPER_PLAN.slice(0, 4));
    expectError(transition(atPlanFeedback, { type: "PLAN_FEEDBACK_DONE" }), "guard_failed");
    const reviewed = run(atPlanFeedback, [{ type: "PLAN_REVIEWED", review: makePlanReview() }]);
    expectError(transition(reviewed, { type: "PLAN_REVIEWED", review: makePlanReview() }), "guard_failed");
    expectError(transition(reviewed, { type: "CONTENT_FLAGGED" }), "guard_failed");
    const atFeedback = run(start(4), [...PAPER_PLAN, ...PAPER_TEXT, { type: "SELF_CHECK_SUBMITTED", selfCheck }]);
    expectError(transition(atFeedback, { type: "START_REVISION" }), "guard_failed");
    expectError(transition(atFeedback, { type: "USE_JOKER", keys: 2 }), "guard_failed");
  });

  it("accepts nothing after completion", () => {
    const done = run(start(1), [{ type: "BRIEFING_ACK" }, { type: "TEXT_TYPED", paragraphs: TEXT }, ...FEEDBACK_AND_REVISION]);
    expect(done.state).toBe("completed");
    for (const event of [{ type: "BRIEFING_ACK" }, { type: "ADULT_RELEASED" }, { type: "START_REVISION" }] as const) {
      expectError(transition(done, event), "illegal_transition");
    }
  });

  it("replay stops at the first error", () => {
    const result = replay(start(4), [{ type: "BRIEFING_ACK" }, { type: "START_WRITING" }, { type: "PLAN_UPLOADED" }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatchObject({ state: "planning", event: "START_WRITING" });
  });
});

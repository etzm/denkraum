// Domain additions of phase B1: model failures in the state machine, formative stars without
// dimension D, XP of a run, content approval and the rubric for P4.

import { describe, expect, it } from "vitest";
import { formativeStars, isMissionCompleted, isMissionShown, isRevisionDone, missionXp } from "../domain/rules.ts";
import type { MissionEvent, MissionRun } from "../domain/state.ts";
import { completionFacts, createRun, pendingSystemAction, replay, transition } from "../domain/state.ts";
import { paragraphsFromForm, planFromForm, selfCheckFromForm } from "../mission/actions.ts";
import { B1_MISSION_IDS, checklistFor, findMission, rubricFor, RUBRICS, showUnapprovedContent } from "../mission/content.ts";
import { RUBRIC_DIMENSIONS } from "../schemas/content.ts";
import { FULFILLED, makePlan, makePlanReview, makeTextReview, TEXT } from "./fixtures.ts";

function play(events: MissionEvent[]): MissionRun {
  const result = replay(createRun({ missionId: "m-04-01", stufe: 4, niveauEEnabled: false }), events);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.reason}`);
  return result.run;
}

const TYPED_PLAN: MissionEvent[] = [{ type: "BRIEFING_ACK" }, { type: "PLAN_TYPED", plan: makePlan() }];
const TO_FEEDBACK: MissionEvent[] = [
  ...TYPED_PLAN,
  { type: "PLAN_REVIEW_UNAVAILABLE", reason: "timeout" },
  { type: "PLAN_FEEDBACK_DONE" },
  { type: "START_WRITING" },
  { type: "TEXT_TYPED", paragraphs: TEXT },
  { type: "SELF_CHECK_SUBMITTED", selfCheck: { checkedItemIds: [], marks: [] } },
];

describe("model failures never block a run (SW-29)", () => {
  it("P2 unavailable: no review, the code gate decides", () => {
    const waiting = play(TYPED_PLAN);
    expect(pendingSystemAction(waiting)).toBe("review_plan");
    const run = play([...TYPED_PLAN, { type: "PLAN_REVIEW_UNAVAILABLE", reason: "timeout" }]);
    expect(pendingSystemAction(run)).toBeNull();
    expect(run.notes).toContain("plan_review_unavailable");
    expect(transition(run, { type: "PLAN_REVIEWED", review: makePlanReview() }).ok).toBe(false);
    expect(play([...TYPED_PLAN, { type: "PLAN_REVIEW_UNAVAILABLE", reason: "timeout" }, { type: "PLAN_FEEDBACK_DONE" }]).state).toBe(
      "plan_approved",
    );
  });

  it("a new plan round asks P2 again", () => {
    const weak = makePlan({ standpunkt: "" });
    const run = play([
      { type: "BRIEFING_ACK" },
      { type: "PLAN_TYPED", plan: weak },
      { type: "PLAN_REVIEW_UNAVAILABLE", reason: "error" },
      { type: "PLAN_FEEDBACK_DONE" },
      { type: "PLAN_TYPED", plan: makePlan() },
    ]);
    expect(run.plan.reviewUnavailable).toBeNull();
    expect(pendingSystemAction(run)).toBe("review_plan");
  });

  it("P4 unavailable: the revision can start, a joker cannot", () => {
    const run = play([...TO_FEEDBACK, { type: "TEXT_REVIEW_UNAVAILABLE", reason: "refused" }]);
    expect(run.state).toBe("ai_feedback");
    expect(run.notes).toEqual(expect.arrayContaining(["text_review_unavailable", "ai_refused"]));
    expect(pendingSystemAction(run)).toBeNull();
    expect(transition(run, { type: "USE_JOKER", keys: 5 }).ok).toBe(false);
    expect(transition(run, { type: "START_REVISION" }).ok).toBe(true);
  });

  it("P5 unavailable: the attempt counts and the mission completes with a note", () => {
    const run = play([
      ...TO_FEEDBACK,
      { type: "TEXT_REVIEWED", review: makeTextReview() },
      { type: "START_REVISION" },
      { type: "REVISION_SUBMITTED", text: "Aus diesen Gründen bin ich für eine längere Pause." },
      { type: "REVISION_CHECK_UNAVAILABLE", reason: "timeout" },
    ]);
    expect(run.state).toBe("completed");
    expect(run.revision.checks).toEqual([null]);
    expect(run.notes).toContain("revision_check_unavailable");
    expect(isMissionCompleted(completionFacts(run))).toBe(true);
  });

  it("an unavailable event needs something pending", () => {
    const run = play([...TO_FEEDBACK, { type: "TEXT_REVIEWED", review: makeTextReview() }]);
    expect(transition(run, { type: "TEXT_REVIEW_UNAVAILABLE", reason: "error" }).ok).toBe(false);
    const revising = play([...TO_FEEDBACK, { type: "TEXT_REVIEWED", review: makeTextReview() }, { type: "START_REVISION" }]);
    expect(transition(revising, { type: "REVISION_CHECK_UNAVAILABLE", reason: "error" }).ok).toBe(false);
    expect(transition(revising, { type: "REVISION_SUBMITTED", text: "x" }).ok).toBe(true);
  });

  it("isRevisionDone counts an unchecked attempt", () => {
    expect(isRevisionDone(1, null, true)).toBe(true);
    expect(isRevisionDone(1, null)).toBe(false);
    expect(isRevisionDone(1, false, false)).toBe(false);
  });
});

describe("formative stars in B1 (D-020, D-021)", () => {
  it("leaves dimension D out without a rule based count and ignores the model's D", () => {
    const review = makeTextReview({ scores: { aufbau: 3, argumentation: 2, sprache: 1, richtigkeit: 0 } });
    expect(formativeStars({ ai: review, richtigkeit: null, stufe: 4, typedFallback: true })).toEqual({
      aufbau: 3,
      argumentation: 2,
      sprache: 1,
      richtigkeit: null,
      shown: 6,
      max: 9,
      capped: false,
    });
  });

  it("uses the error count for D and the typed cap once D exists", () => {
    const review = makeTextReview({ scores: { aufbau: 3, argumentation: 3, sprache: 3, richtigkeit: 0 } });
    const stars = formativeStars({ ai: review, richtigkeit: { errorsPer100Words: 0.5, source: "languagetool" }, stufe: 4, typedFallback: true });
    expect(stars).toMatchObject({ richtigkeit: 3, shown: 10, max: 12, capped: true });
  });
});

describe("XP of a run (SW-07)", () => {
  it("gives 100 for completion and 20 for the revision, nothing before completion", () => {
    expect(missionXp({ completed: true, revisionsSubmitted: 2 })).toBe(120);
    expect(missionXp({ completed: true, revisionsSubmitted: 0 })).toBe(100);
    expect(missionXp({ completed: false, revisionsSubmitted: 1 })).toBe(0);
  });

  it("does not depend on the review", () => {
    const base: MissionEvent[] = [...TO_FEEDBACK];
    const tail: MissionEvent[] = [
      { type: "START_REVISION" },
      { type: "REVISION_SUBMITTED", text: "Neu." },
      { type: "REVISION_CHECKED", check: FULFILLED },
    ];
    const zero = play([...base, { type: "TEXT_REVIEWED", review: makeTextReview({ scores: { aufbau: 0, argumentation: 0, sprache: 0, richtigkeit: 0 } }) }, ...tail]);
    const none = play([...base, { type: "TEXT_REVIEW_UNAVAILABLE", reason: "error" }, ...tail]);
    for (const run of [zero, none]) {
      expect(run.state).toBe("completed");
      expect(missionXp({ completed: true, revisionsSubmitted: run.revision.texts.length })).toBe(120);
    }
  });
});

describe("content approval (D-022)", () => {
  const mission = findMission("m-04-01")!;

  it("shows unapproved missions only with the operator switch", () => {
    expect(mission.approved).toBe(false);
    expect(isMissionShown(mission, false)).toBe(false);
    expect(isMissionShown(mission, true)).toBe(true);
    expect(isMissionShown({ approved: true }, false)).toBe(true);
    expect(showUnapprovedContent({ DENKRAUM_SHOW_UNAPPROVED: "true" })).toBe(true);
    expect(showUnapprovedContent({ DENKRAUM_SHOW_UNAPPROVED: "1" })).toBe(false);
    expect(showUnapprovedContent({})).toBe(false);
  });

  it("plays m-04-01 in B1", () => {
    expect(B1_MISSION_IDS).toEqual(["m-04-01"]);
    expect(checklistFor(mission).id).toBe("cl-04");
  });
});

describe("rubric for P4 (spec 7.1)", () => {
  it("has A to D with four levels each, waits for approval and fits the mission", () => {
    expect(RUBRICS).toHaveLength(1);
    const rubric = rubricFor(findMission("m-04-01")!);
    expect(rubric.dimensions.map((d) => d.id)).toEqual([...RUBRIC_DIMENSIONS]);
    expect(rubric.dimensions.every((d) => d.levels.length === 4)).toBe(true);
    expect(rubric.approved).toBe(false);
  });
});

describe("form parsing", () => {
  const data = (entries: [string, string][]) => {
    const f = new FormData();
    for (const [k, v] of entries) f.append(k, v);
    return f;
  };

  it("makes every line a paragraph", () => {
    expect(paragraphsFromForm(data([["text", "Erster Absatz.\r\n\r\nZweiter Absatz.\nDritter.  \n\n"]]))).toEqual([
      "Erster Absatz.",
      "Zweiter Absatz.",
      "Dritter.",
    ]);
  });

  it("builds the self check from known items and sentence numbers only", () => {
    const long = `${"Wort ".repeat(450)}Ende.`;
    const paragraphs = ["Ich bin dafür. Ein Beispiel ist die Mensa.", long];
    const check = selfCheckFromForm(
      data([
        ["punkt", "einleitung"],
        ["punkt", "erfunden"],
        ["these", "0"],
        ["beispiel", "1"],
        ["beispiel", "2"],
        ["beispiel", "9"],
      ]),
      paragraphs,
      ["einleitung", "bbb"],
    );
    expect(check).toEqual({
      checkedItemIds: ["einleitung"],
      marks: [
        { part: "these", quote: "Ich bin dafür." },
        { part: "beispiel", quote: "Ein Beispiel ist die Mensa." },
      ],
    });
  });

  it("reads the plan boxes", () => {
    const plan = planFromForm(data([["standpunkt", "  Ich bin dafür. "], ["a2_beispiel", "Mensa"]]));
    expect(plan.standpunkt).toBe("Ich bin dafür.");
    expect(plan.argumente[1]!.beispiel).toBe("Mensa");
    expect(plan.argumente).toHaveLength(3);
    expect(plan.legibility).toBe(1);
  });
});

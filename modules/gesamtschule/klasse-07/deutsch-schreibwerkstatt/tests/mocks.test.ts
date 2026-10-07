import { describe, expect, it } from "vitest";
import { findGhostwriting, planReviewFields, revisionTaskFor, textReviewFields } from "../domain/feedback.ts";
import { checkReviewQuotes } from "../domain/quotes.ts";
import { planGate } from "../domain/rules.ts";
import { createRun, replay, type MissionRun } from "../domain/state.ts";
import { paragraphsToText, planToText } from "../domain/text.ts";
import { planReviewInput, revisionCheckInput, textReviewInput } from "../mission/ai-input.ts";
import { findMission, HELP_CARDS } from "../mission/content.ts";
import { MOCK_FIXTURES, MOCK_MARKERS, mockPlanReview, mockRevisionCheck, mockTextReview } from "../mission/mocks.ts";
import type { PlanTranscript } from "../schemas/planTranscript.ts";
import { planReviewSchema } from "../schemas/planReview.ts";
import { revisionCheckSchema } from "../schemas/revisionCheck.ts";
import { textReviewSchema } from "../schemas/textReview.ts";
import { makePlan, makeWeakPlan, TEXT } from "./fixtures.ts";

const mission = findMission("m-04-01")!;
const request = (input: unknown) => ({ userText: JSON.stringify(input, null, 2) });

function runAt(plan: PlanTranscript, paragraphs: string[] = TEXT): MissionRun {
  const result = replay(createRun({ missionId: mission.id, stufe: 4, niveauEEnabled: false }), [
    { type: "BRIEFING_ACK" },
    { type: "PLAN_TYPED", plan },
    { type: "PLAN_REVIEW_UNAVAILABLE", reason: "error" },
    { type: "PLAN_FEEDBACK_DONE" },
    { type: "START_WRITING" },
    { type: "TEXT_TYPED", paragraphs },
    { type: "SELF_CHECK_SUBMITTED", selfCheck: { checkedItemIds: ["einleitung"], marks: [] } },
  ]);
  if (!result.ok) throw new Error(result.error.reason);
  return result.run;
}

/** A run waiting for P2. */
function planRun(plan: PlanTranscript): MissionRun {
  const result = replay(createRun({ missionId: mission.id, stufe: 4, niveauEEnabled: false }), [
    { type: "BRIEFING_ACK" },
    { type: "PLAN_TYPED", plan },
  ]);
  if (!result.ok) throw new Error(result.error.reason);
  return result.run;
}

/** Synthetic sample texts for m-04-01, built from interchangeable parts (no real student material). */
function sampleTexts(): string[][] {
  const intros = [
    "An unserer Schule wird diskutiert, ob die Mittagspause länger werden soll. Ich bin der Meinung, dass sie länger werden muss.",
    "Die Schulkonferenz fragt, ob wir eine längere Mittagspause brauchen. Ich finde, dass wir sie brauchen.",
  ];
  const args = [
    "Zunächst haben wir mehr Zeit zum Essen. Die Schlange in der Mensa ist lang. Gestern habe ich zum Beispiel zwanzig Minuten gewartet.",
    "Außerdem können wir uns mehr bewegen. Bewegung macht wach. In unserer Klasse spielen viele Fußball, wenn genug Zeit ist.",
    "Vor allem aber lernen wir danach besser. Nach einer Pause ist der Kopf frei. Letzte Woche war die Mathestunde nach der langen Pause zum Beispiel viel ruhiger.",
  ];
  const endings = [
    "Deshalb bitte ich die Schulkonferenz, die Mittagspause zu verlängern.",
    "Aus diesen Gründen bin ich für eine längere Mittagspause.",
  ];
  const texts: string[][] = [];
  for (let i = 0; i < 10; i++) {
    const order = [args[i % 3]!, args[(i + 1) % 3]!, args[(i + 2) % 3]!];
    texts.push([intros[i % 2]!, ...order, endings[Math.floor(i / 2) % 2]!]);
  }
  return texts;
}

describe("mock plan_review (P2)", () => {
  it("answers in the schema and agrees with the code gate", () => {
    for (const plan of [makePlan(), makeWeakPlan(), makePlan({ standpunkt: "", argumente: makePlan().argumente })]) {
      const review = planReviewSchema.parse(mockPlanReview(request(planReviewInput(mission, planRun(plan)))));
      expect(review.approved).toBe(planGate(plan, "planning_sheet").approved);
      expect(findGhostwriting(planReviewFields(review), planToText(plan), [])).toEqual([]);
    }
  });

  it("rates the weak plan red where it is missing", () => {
    const review = mockPlanReview(request(planReviewInput(mission, planRun(makeWeakPlan()))))!;
    expect(review.criteria.P1).toBe("rot");
    expect(review.missing).toContain("Standpunkt");
  });

  it("can be made to fail", () => {
    const input = planReviewInput(mission, planRun(makePlan({ thema: MOCK_MARKERS.noAnswer })));
    expect(mockPlanReview(request(input))).toBeNull();
  });
});

describe("mock text_review (P4)", () => {
  it("passes schema and quote check for ten sample texts and never writes for the student", () => {
    const phrases = HELP_CARDS.flatMap((c) => c.content.phrases);
    for (const paragraphs of sampleTexts()) {
      const run = runAt(makePlan(), paragraphs);
      const review = textReviewSchema.parse(mockTextReview(request(textReviewInput(mission, run))));
      expect(checkReviewQuotes(review, paragraphs)).toEqual({ ok: true, failures: [] });
      expect(review.lens.these).not.toBe("");
      expect(findGhostwriting(textReviewFields(review), paragraphsToText(paragraphs), phrases)).toEqual([]);
    }
  });

  it("reads the request even after the platform appended a retry note", () => {
    const run = runAt(makePlan());
    const userText = `${request(textReviewInput(mission, run)).userText}\n\nDeine vorige Antwort passte nicht zum Schema (x). Antworte nur mit gültigem JSON nach dem Schema.`;
    expect(textReviewSchema.safeParse(mockTextReview({ userText })).success).toBe(true);
  });

  it("flags the inappropriate marker and changes quotes on request", () => {
    const flagged = mockTextReview(request(textReviewInput(mission, runAt(makePlan(), [...TEXT, MOCK_MARKERS.inappropriate]))))!;
    expect(textReviewSchema.parse(flagged).flags.inappropriate).toBe(true);
    const paragraphs = [...TEXT, MOCK_MARKERS.quoteMismatch];
    const mismatch = mockTextReview(request(textReviewInput(mission, runAt(makePlan(), paragraphs))))!;
    expect(checkReviewQuotes(textReviewSchema.parse(mismatch), paragraphs).ok).toBe(false);
  });
});

describe("mock revision_check (P5)", () => {
  const task = revisionTaskFor(runAt(makePlan()))!;

  it("is fulfilled for a changed passage and not for an unchanged one or the marker", () => {
    const check = (text: string) => revisionCheckSchema.parse(mockRevisionCheck(request(revisionCheckInput(task, text))));
    expect(check("Aus diesen Gründen bin ich für eine längere Pause, liebe Schulkonferenz.").fulfilled).toBe(true);
    expect(check(task.targetQuote).fulfilled).toBe(false);
    expect(check(`Neu ${MOCK_MARKERS.notFulfilled}`).fulfilled).toBe(false);
  });

  it("covers every prompt the module calls in B1", () => {
    expect(Object.keys(MOCK_FIXTURES).sort()).toEqual(["plan_review", "revision_check", "text_review"]);
  });
});

// Read-only summaries of finished or running missions: formative stars, badge counters
// and the quality check "feedback writes text for the child" (spec 7.7). Pure functions.
//
// Nothing here gates progress (SW-01). Stars are shown to the child; badge counters may
// read AI output because badges unlock nothing (SW-18).

import { isFlagged, type TextReview } from "../schemas/textReview.ts";
import type { BadgeStats, StarSummary } from "./rules.ts";
import { betterStars, computeStars, countArgumentsWithReason, everyArgumentHasExample } from "./rules.ts";
import type { MissionRun } from "./state.ts";
import { paragraphsToText } from "./text.ts";

function starsOf(run: MissionRun, review: TextReview): StarSummary {
  return computeStars({
    ai: review,
    // v1: dimension D from the review's error count, until LanguageTool counts it (SW-06).
    richtigkeit: { errorsPer100Words: review.error_density, source: "ai_review" },
    niveauEEnabled: run.niveauEEnabled,
    stufe: run.stufe,
    typedFallback: run.typedFallback,
  });
}

/** The stars the child sees for a run: the better of the two passes after a joker (SW-13). Null without a usable review. */
export function runStars(run: MissionRun): StarSummary | null {
  const current = run.feedback.review;
  const first = run.feedback.firstPassReview;
  const candidates = [first, current].filter((r): r is TextReview => r !== null && !isFlagged(r));
  if (candidates.length === 0) return null;
  return candidates.map((r) => starsOf(run, r)).reduce((a, b) => betterStars(a, b));
}

/** Counters for `earnedBadges`, aggregated over all runs of a learner. */
export function badgeStats(
  runs: readonly MissionRun[],
  extra: { streakDays: number; correctCompleteBbb: number },
): BadgeStats {
  const completed = runs.filter((r) => r.state === "completed");
  const verifiedReview = (r: MissionRun) => (r.feedback.quotesVerified && r.feedback.review && !isFlagged(r.feedback.review) ? r.feedback.review : null);
  return {
    plansApprovedFirstTry: runs.filter((r) => r.plan.approvedInRound === 1).length,
    claimsWithReason:
      runs.reduce((n, r) => n + (r.plan.confirmed && r.plan.gate?.approved ? countArgumentsWithReason(r.plan.confirmed) : 0), 0) +
      extra.correctCompleteBbb,
    missionsWithExampleForEveryArgument: completed.filter((r) => {
      const review = verifiedReview(r);
      return review !== null && everyArgumentHasExample(review.lens);
    }).length,
    missionsWithSpracheThree: completed.filter((r) => r.feedback.review?.scores.sprache === 3).length,
    revisionsFulfilled: runs.reduce((n, r) => n + r.revision.checks.filter((c) => c.fulfilled).length, 0),
    missionsWithRebuttal: completed.filter((r) => {
      const g = verifiedReview(r)?.lens.gegenargument;
      return g !== undefined && g.einwand.trim() !== "" && g.entkraeftung.trim() !== "";
    }).length,
    streakDays: extra.streakDays,
  };
}

// ---------------------------------------------------------------------------
// Quality check: the AI must never write the text for the child (spec 2.1 no. 4, 7.7)

const GHOSTWRITING = [
  /\bdu (könntest|kannst|solltest) (zum beispiel |z\. ?b\. )?(schreiben|formulieren)\b/i,
  /\bschreib(e)? (doch )?(zum beispiel|z\. ?b\.|so|etwa)\s*:/i,
  /\bformulier(e)? (es |ihn |den satz )?(so|etwa)\b/i,
  /\b(beispielsatz|mustersatz|musterlösung|verbesserte fassung|überarbeitete fassung)\b/i,
  /\bso könnte (dein|der) (satz|text|absatz|schluss|einleitung)\b/i,
];

/** Longer passages in quotation marks that are not the child's own words count as written for the child. */
const QUOTED = /[„"“»]([^"“”«]{20,})["“”«]/g;
const MAX_QUOTED_WORDS = 6;

/** Student-visible fields of a review (quotes of the child's own text excluded). */
function visibleTexts(review: TextReview): string[] {
  return [...review.strengths.map((s) => s.text), review.next_step, review.revision_task.instruction, review.self_check_note];
}

/** Findings where a review writes text for the child; empty when the review is clean. */
export function ghostwritingFindings(review: TextReview, paragraphs: readonly string[]): string[] {
  const source = paragraphsToText(paragraphs).normalize("NFC");
  const findings: string[] = [];
  for (const text of visibleTexts(review)) {
    for (const pattern of GHOSTWRITING) if (pattern.test(text)) findings.push(text);
    for (const match of text.matchAll(QUOTED)) {
      const quoted = match[1]!.trim();
      if (quoted.split(/\s+/).length > MAX_QUOTED_WORDS && !source.includes(quoted.normalize("NFC"))) findings.push(quoted);
    }
  }
  return [...new Set(findings)];
}

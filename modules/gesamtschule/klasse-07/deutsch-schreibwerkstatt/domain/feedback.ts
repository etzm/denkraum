// Pure helpers for showing feedback and choosing the revision task (phase B1). No I/O.
//
// - The Textlupe marks only exact quotes (spec 7.4, SW-19).
// - The revision task comes from P4 when its target is an exact quote of the text; otherwise
//   code picks a fixed task, so the mission never waits for the model (SW-29, SW-30).

import type { PlanReview } from "../schemas/planReview.ts";
import type { TextReview } from "../schemas/textReview.ts";
import { isFlagged } from "../schemas/textReview.ts";
import { isExactQuote } from "./quotes.ts";
import type { MissionRun } from "./state.ts";
import { countWords, paragraphsToText } from "./text.ts";

// ---------------------------------------------------------------------------
// Sentences (optional marks in self_check)

const SENTENCE = /[^.!?]+(?:[.!?]+["'«»“”„]?|$)/gu;

/** Sentences of the text in order. Each is an exact substring, so a mark built from it passes the quote check. */
export function splitSentences(paragraphs: readonly string[]): string[] {
  const out: string[] = [];
  for (const paragraph of paragraphs) {
    for (const match of paragraph.matchAll(SENTENCE)) {
      const sentence = match[0].trim();
      if (/\p{L}/u.test(sentence)) out.push(sentence);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Textlupe

export type LensPart = "these" | "behauptung" | "begruendung" | "beispiel" | "einwand" | "entkraeftung";
export type LensMark = { part: LensPart; quote: string };
export type LensSegment = { text: string; part: LensPart | null };

export const LENS_LABELS: Record<LensPart, string> = {
  these: "These",
  behauptung: "Behauptung",
  begruendung: "Begründung",
  beispiel: "Beispiel",
  einwand: "Einwand",
  entkraeftung: "Entkräftung",
};

/** All non-empty lens quotes, thesis first, then the arguments in order. */
export function lensMarks(lens: TextReview["lens"]): LensMark[] {
  const marks: LensMark[] = [{ part: "these", quote: lens.these }];
  for (const a of lens.argumente) {
    marks.push({ part: "behauptung", quote: a.behauptung }, { part: "begruendung", quote: a.begruendung }, { part: "beispiel", quote: a.beispiel });
  }
  if (lens.gegenargument) {
    marks.push({ part: "einwand", quote: lens.gegenargument.einwand }, { part: "entkraeftung", quote: lens.gegenargument.entkraeftung });
  }
  return marks.filter((m) => m.quote.trim() !== "");
}

/**
 * Splits the text into marked and unmarked segments. A quote is placed at its first occurrence
 * that does not overlap an earlier mark; quotes that are not found are left out.
 */
export function lensSegments(text: string, marks: readonly LensMark[]): LensSegment[] {
  const source = text.normalize("NFC");
  const ranges: { start: number; end: number; part: LensPart }[] = [];
  for (const mark of marks) {
    const quote = mark.quote.normalize("NFC");
    if (quote.trim() === "") continue;
    for (let start = source.indexOf(quote); start >= 0; start = source.indexOf(quote, start + 1)) {
      const end = start + quote.length;
      if (!ranges.some((r) => start < r.end && r.start < end)) {
        ranges.push({ start, end, part: mark.part });
        break;
      }
    }
  }
  ranges.sort((a, b) => a.start - b.start);
  const segments: LensSegment[] = [];
  let at = 0;
  for (const r of ranges) {
    if (r.start > at) segments.push({ text: source.slice(at, r.start), part: null });
    segments.push({ text: source.slice(r.start, r.end), part: r.part });
    at = r.end;
  }
  if (at < source.length) segments.push({ text: source.slice(at), part: null });
  return segments;
}

// ---------------------------------------------------------------------------
// Revision task

export type RevisionTask = {
  /** "ai": formulated by P4 and labelled as AI feedback; "app": fixed task chosen by code. */
  source: "ai" | "app";
  instruction: string;
  /** Exact passage of the student's text. */
  targetQuote: string;
  helpCardId: string;
};

/** Fallback when P4 gave no usable task (SW-30): the conclusion of a full text, which checklist cl-04 also asks about. */
export const APP_REVISION_TASK = {
  instruction:
    "Lies deinen Schluss noch einmal. Nenne darin deinen Standpunkt und ende mit einer Bitte oder einem Ausblick. Bring kein neues Argument.",
  helpCardId: "HK-06",
} as const;

/** Fallback for a single paragraph (stages 1 and 2). */
export const APP_REVISION_TASK_PARAGRAPH = {
  instruction: "Lies deinen Absatz noch einmal. Verbinde zwei Sätze mit einem passenden Verknüpfungswort.",
  helpCardId: "HK-03",
} as const;

export function revisionTaskFor(run: Pick<MissionRun, "text" | "feedback">): RevisionTask | null {
  const paragraphs = (run.text.confirmed ?? []).filter((p) => p.trim() !== "");
  if (paragraphs.length === 0) return null;
  const review = run.feedback.review;
  if (review && !isFlagged(review)) {
    const task = review.revision_task;
    if (task.target_quote.trim() !== "" && isExactQuote(task.target_quote, paragraphsToText(run.text.confirmed ?? []))) {
      return { source: "ai", instruction: task.instruction, targetQuote: task.target_quote, helpCardId: task.help_card_id };
    }
  }
  const fallback = paragraphs.length === 1 ? APP_REVISION_TASK_PARAGRAPH : APP_REVISION_TASK;
  return { source: "app", instruction: fallback.instruction, targetQuote: paragraphs.at(-1)!.trim(), helpCardId: fallback.helpCardId };
}

// ---------------------------------------------------------------------------
// "The AI never writes for the student" (spec 2.1 Nr. 4, 7.7): regex and length check

const GHOSTWRITING_PATTERNS: readonly RegExp[] = [
  /du k[öo]nntest (zum beispiel |etwa |z\. ?b\. )?(schreiben|sagen|formulieren)/iu,
  /schreib(e)? (doch |lieber |stattdessen |einfach )+/iu,
  /\b(besser|so) w[äa]re:/iu,
  /ein m[öo]glicher satz/iu,
  /zum beispiel so:/iu,
  /(formulier|schreib)(e)? (ihn|es|den satz|das|ihn lieber) (so|wie folgt)/iu,
];

/** A single student-facing field longer than this reads like a rewrite, not like feedback. */
export const MAX_WORDS_PER_FIELD = 60;

const QUOTED = /["„“»«]([^"„“”»«]{3,})["“”«»]/gu;

/**
 * Hits where feedback seems to write text for the student: known phrases, overlong fields, or
 * quoted wording of more than three words that is neither the student's own text nor a help card phrase.
 */
export function findGhostwriting(fields: readonly string[], ownText: string, helpCardPhrases: readonly string[]): string[] {
  const phrases = helpCardPhrases.map((p) => p.replaceAll("...", " ").replace(/\s+/g, " ").trim());
  const hits: string[] = [];
  for (const field of fields) {
    for (const pattern of GHOSTWRITING_PATTERNS) if (pattern.test(field)) hits.push(`phrase: ${field}`);
    if (countWords(field) > MAX_WORDS_PER_FIELD) hits.push(`length: ${field}`);
    for (const match of field.matchAll(QUOTED)) {
      const quoted = match[1]!.replaceAll("...", " ").replace(/\s+/g, " ").trim();
      if (countWords(quoted) <= 3) continue;
      if (isExactQuote(quoted, ownText) || phrases.some((p) => p.includes(quoted))) continue;
      hits.push(`quote: ${quoted}`);
    }
  }
  return hits;
}

/** Student-facing fields of a text review (quotes of the student's own text are excluded). */
export function textReviewFields(review: TextReview): string[] {
  return [...review.strengths.map((s) => s.text), review.next_step, review.revision_task.instruction, review.self_check_note].filter(
    (f) => f.trim() !== "",
  );
}

/** Student-facing fields of a plan review. The mirror may repeat the plan, so it is checked against the plan text. */
export function planReviewFields(review: PlanReview): string[] {
  return [review.mirror, review.question];
}

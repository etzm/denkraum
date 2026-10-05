// Small text helpers shared by rules, state machine, quote check and schemas.
// Pure functions, no I/O.

import type { PlanTranscript } from "../schemas/planTranscript.ts";

/** Marker the transcription uses for illegible text (spec 6.3). */
export const ILLEGIBLE = "[?]";

const WORD_TOKEN = /[\p{L}\p{N}]|\[\?\]/u;

/** Counts words: whitespace separated tokens with a letter, digit or an illegible marker. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((token) => WORD_TOKEN.test(token)).length;
}

/** True when a field holds real content, not just blanks or illegible markers. */
export function isFilled(value: string): boolean {
  return /\p{L}/u.test(value.split(ILLEGIBLE).join(""));
}

function codePoints(value: string): string[] {
  return Array.from(value.normalize("NFC"));
}

/** Levenshtein distance on Unicode code points (NFC). */
export function levenshtein(a: string, b: string): number {
  const s = codePoints(a);
  const t = codePoints(b);
  if (s.length === 0) return t.length;
  if (t.length === 0) return s.length;
  let prev = Array.from({ length: t.length + 1 }, (_, j) => j);
  let cur = new Array<number>(t.length + 1).fill(0);
  for (let i = 1; i <= s.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[t.length]!;
}

/** Levenshtein distance divided by the longer length; 0 means identical, 1 means nothing in common. */
export function editDistanceRatio(raw: string, confirmed: string): number {
  const longer = Math.max(codePoints(raw).length, codePoints(confirmed).length);
  return longer === 0 ? 0 : levenshtein(raw, confirmed) / longer;
}

/** The text as one string; paragraphs are separated by a blank line. */
export function paragraphsToText(paragraphs: readonly string[]): string {
  return paragraphs.join("\n\n");
}

/** All boxes of a plan as one string, in sheet order, for the edit distance. */
export function planToText(plan: PlanTranscript): string {
  const parts = [plan.thema, plan.standpunkt];
  for (const a of plan.argumente) parts.push(a.behauptung, a.begruendung, a.beispiel);
  parts.push(plan.reihenfolge, plan.schluss);
  if (plan.gegenargument) parts.push(plan.gegenargument.einwand, plan.gegenargument.entkraeftung);
  return parts.join("\n");
}

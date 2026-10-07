// Textlupe: marks the parts the review found (these, claim, reason, example) in the child's
// own paragraphs. Pure functions; quotes that are not found are simply not marked (SW-19).

import type { TextReview } from "../schemas/textReview.ts";

export type LensMark = "these" | "behauptung" | "begruendung" | "beispiel" | "einwand" | "entkraeftung";
export type LensQuote = { quote: string; mark: LensMark };
export type Segment = { text: string; mark: LensMark | null };

export function lensQuotes(lens: TextReview["lens"]): LensQuote[] {
  const quotes: LensQuote[] = [{ quote: lens.these, mark: "these" }];
  for (const a of lens.argumente) {
    quotes.push({ quote: a.behauptung, mark: "behauptung" }, { quote: a.begruendung, mark: "begruendung" }, { quote: a.beispiel, mark: "beispiel" });
  }
  if (lens.gegenargument) {
    quotes.push({ quote: lens.gegenargument.einwand, mark: "einwand" }, { quote: lens.gegenargument.entkraeftung, mark: "entkraeftung" });
  }
  return quotes.filter((q) => q.quote.trim() !== "");
}

/** Splits each paragraph into marked and unmarked segments; overlapping marks keep the earlier one. */
export function lensSegments(paragraphs: readonly string[], quotes: readonly LensQuote[]): Segment[][] {
  return paragraphs.map((raw) => {
    const paragraph = raw.normalize("NFC");
    const ranges = quotes
      .map((q) => {
        const quote = q.quote.normalize("NFC");
        const start = paragraph.indexOf(quote);
        return start < 0 ? null : { start, end: start + quote.length, mark: q.mark };
      })
      .filter((r) => r !== null)
      .sort((a, b) => a.start - b.start || b.end - a.end);
    const segments: Segment[] = [];
    let at = 0;
    for (const r of ranges) {
      if (r.start < at) continue;
      if (r.start > at) segments.push({ text: paragraph.slice(at, r.start), mark: null });
      segments.push({ text: paragraph.slice(r.start, r.end), mark: r.mark });
      at = r.end;
    }
    if (at < paragraph.length) segments.push({ text: paragraph.slice(at), mark: null });
    return segments;
  });
}

export const LENS_LABELS: Record<LensMark, string> = {
  these: "These",
  behauptung: "Behauptung",
  begruendung: "Begründung",
  beispiel: "Beispiel",
  einwand: "Gegenargument",
  entkraeftung: "Entkräftung",
};

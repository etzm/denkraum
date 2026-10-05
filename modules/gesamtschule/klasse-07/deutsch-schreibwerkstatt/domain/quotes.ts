// Quote check for P4 text reviews (spec 7.4): every quote must be an exact
// substring of the confirmed transcript. Both sides are compared in NFC so that
// composed and decomposed umlauts match; nothing else is normalized.

import type { TextReview } from "../schemas/textReview.ts";
import { isFlagged } from "../schemas/textReview.ts";
import { paragraphsToText } from "./text.ts";

export type QuoteFailure = { path: string; quote: string };
export type QuoteCheck = { ok: boolean; failures: QuoteFailure[] };

export function isExactQuote(quote: string, source: string): boolean {
  return source.normalize("NFC").includes(quote.normalize("NFC"));
}

/**
 * All quotes of a review with their path. Lens quotes may be empty ("missing").
 * Strength quotes and the revision target are required unless the review is flagged.
 */
export function reviewQuotes(review: TextReview): { path: string; quote: string; required: boolean }[] {
  const required = !isFlagged(review);
  const quotes = [{ path: "lens.these", quote: review.lens.these, required: false }];
  review.lens.argumente.forEach((a, i) => {
    quotes.push(
      { path: `lens.argumente.${i}.behauptung`, quote: a.behauptung, required: false },
      { path: `lens.argumente.${i}.begruendung`, quote: a.begruendung, required: false },
      { path: `lens.argumente.${i}.beispiel`, quote: a.beispiel, required: false },
    );
  });
  const g = review.lens.gegenargument;
  if (g) {
    quotes.push(
      { path: "lens.gegenargument.einwand", quote: g.einwand, required: false },
      { path: "lens.gegenargument.entkraeftung", quote: g.entkraeftung, required: false },
    );
  }
  review.strengths.forEach((s, i) => quotes.push({ path: `strengths.${i}.quote`, quote: s.quote, required }));
  quotes.push({ path: "revision_task.target_quote", quote: review.revision_task.target_quote, required });
  return quotes;
}

export function checkReviewQuotes(review: TextReview, confirmedParagraphs: readonly string[]): QuoteCheck {
  const source = paragraphsToText(confirmedParagraphs);
  const failures: QuoteFailure[] = [];
  for (const { path, quote, required } of reviewQuotes(review)) {
    if (quote.trim() === "") {
      if (required) failures.push({ path, quote });
      continue;
    }
    if (!isExactQuote(quote, source)) failures.push({ path, quote });
  }
  return { ok: failures.length === 0, failures };
}

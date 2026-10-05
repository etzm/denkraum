import { describe, expect, it } from "vitest";
import { checkReviewQuotes, isExactQuote, reviewQuotes } from "../domain/quotes.ts";
import { makeTextReview, TEXT } from "./fixtures.ts";

describe("checkReviewQuotes", () => {
  it("accepts a review whose quotes are all in the confirmed text", () => {
    expect(checkReviewQuotes(makeTextReview(), TEXT)).toEqual({ ok: true, failures: [] });
  });

  it("covers lens, strengths and revision target", () => {
    const paths = reviewQuotes(makeTextReview()).map((q) => q.path);
    expect(paths).toContain("lens.these");
    expect(paths).toContain("lens.argumente.1.beispiel");
    expect(paths).toContain("strengths.0.quote");
    expect(paths).toContain("revision_task.target_quote");
  });

  it("reports every quote that is not an exact substring", () => {
    const review = makeTextReview();
    review.lens.argumente[0]!.begruendung = "Viele müssen schnell essen.";
    review.strengths[1]!.quote = "gestern hatte ich zum Beispiel nur zehn Minuten";
    review.lens.gegenargument = { einwand: "Manche sagen, das kostet Zeit.", entkraeftung: "" };
    expect(checkReviewQuotes(review, TEXT).failures.map((f) => f.path)).toEqual([
      "lens.argumente.0.begruendung",
      "lens.gegenargument.einwand",
      "strengths.1.quote",
    ]);
  });

  it("allows empty lens fields but not empty strength or target quotes", () => {
    const review = makeTextReview();
    review.lens.these = "";
    expect(checkReviewQuotes(review, TEXT).ok).toBe(true);
    review.revision_task.target_quote = " ";
    expect(checkReviewQuotes(review, TEXT).failures).toEqual([{ path: "revision_task.target_quote", quote: " " }]);
  });

  it("allows empty quotes in a flagged review", () => {
    const review = makeTextReview({
      strengths: [],
      revision_task: { instruction: "", target_quote: "", help_card_id: "" },
      flags: { too_short: false, off_topic: true, inappropriate: false },
    });
    expect(checkReviewQuotes(review, TEXT).ok).toBe(true);
  });

  it("compares in NFC and keeps paragraph breaks", () => {
    expect(isExactQuote("Gru\u0308nden", "Aus diesen Gr\u00fcnden")).toBe(true);
    const spanning = "viele müde.\n\nAus diesen";
    expect(checkReviewQuotes(makeTextReview({ lens: { these: spanning, argumente: [] } }), TEXT).ok).toBe(true);
    expect(checkReviewQuotes(makeTextReview({ lens: { these: "viele müde. Aus diesen", argumente: [] } }), TEXT).ok).toBe(false);
  });
});

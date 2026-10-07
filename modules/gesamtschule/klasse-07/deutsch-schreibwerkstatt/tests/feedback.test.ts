import { describe, expect, it } from "vitest";
import {
  APP_REVISION_TASK,
  APP_REVISION_TASK_PARAGRAPH,
  findGhostwriting,
  lensMarks,
  lensSegments,
  revisionTaskFor,
  splitSentences,
  textReviewFields,
} from "../domain/feedback.ts";
import { isExactQuote } from "../domain/quotes.ts";
import { createRun, type MissionRun } from "../domain/state.ts";
import { paragraphsToText } from "../domain/text.ts";
import { makeTextReview, TEXT } from "./fixtures.ts";

function runWith(review: MissionRun["feedback"]["review"], paragraphs: string[] | null = TEXT): MissionRun {
  const run = createRun({ missionId: "m-04-01", stufe: 4, niveauEEnabled: false });
  return { ...run, text: { ...run.text, confirmed: paragraphs }, feedback: { ...run.feedback, review } };
}

describe("splitSentences", () => {
  it("returns exact substrings in order", () => {
    const sentences = splitSentences(TEXT);
    expect(sentences[0]).toBe("An unserer Schule wird diskutiert, ob die Mittagspause länger werden soll.");
    expect(sentences.at(-1)).toBe("Aus diesen Gründen bitte ich die Schulkonferenz, die Mittagspause zu verlängern.");
    for (const s of sentences) expect(isExactQuote(s, paragraphsToText(TEXT))).toBe(true);
  });

  it("keeps a last sentence without full stop and skips lone punctuation", () => {
    expect(splitSentences(["Erster Satz! Zweiter ohne Punkt", "..."])).toEqual(["Erster Satz!", "Zweiter ohne Punkt"]);
  });
});

describe("Textlupe segments", () => {
  it("marks every found quote once and keeps the rest of the text", () => {
    const text = paragraphsToText(TEXT);
    const segments = lensSegments(text, lensMarks(makeTextReview().lens));
    expect(segments.map((s) => s.text).join("")).toBe(text);
    const marked = segments.filter((s) => s.part !== null);
    expect(marked.map((s) => s.part)).toEqual(["these", "behauptung", "begruendung", "beispiel", "behauptung", "begruendung", "beispiel"]);
  });

  it("skips quotes that are not in the text or overlap an earlier mark", () => {
    const segments = lensSegments("Ein Satz. Noch ein Satz.", [
      { part: "these", quote: "Ein Satz." },
      { part: "beispiel", quote: "Satz. Noch" },
      { part: "behauptung", quote: "fehlt" },
      { part: "begruendung", quote: "Satz." },
    ]);
    expect(segments).toEqual([
      { text: "Ein Satz.", part: "these" },
      { text: " Noch ein ", part: null },
      { text: "Satz.", part: "begruendung" },
    ]);
  });

  it("drops empty lens fields", () => {
    const lens = { these: "", argumente: [{ behauptung: "A", begruendung: "", beispiel: "" }] };
    expect(lensMarks(lens)).toEqual([{ part: "behauptung", quote: "A" }]);
  });
});

describe("revision task", () => {
  it("uses the task of P4 when its target is an exact quote", () => {
    expect(revisionTaskFor(runWith(makeTextReview()))).toEqual({
      source: "ai",
      instruction: "Nenne in deinem Schluss noch einmal deinen Standpunkt.",
      targetQuote: TEXT.at(-1),
      helpCardId: "HK-06",
    });
  });

  it("falls back to a task chosen by code without review, with a flagged review or a target not in the text", () => {
    const fallback = { source: "app", instruction: APP_REVISION_TASK.instruction, targetQuote: TEXT.at(-1), helpCardId: "HK-06" };
    expect(revisionTaskFor(runWith(null))).toEqual(fallback);
    const flagged = makeTextReview({ flags: { too_short: false, off_topic: true, inappropriate: false } });
    expect(revisionTaskFor(runWith(flagged))).toEqual(fallback);
    const elsewhere = makeTextReview({ revision_task: { instruction: "Ändere das.", target_quote: "Nicht im Text.", help_card_id: "HK-05" } });
    expect(revisionTaskFor(runWith(elsewhere))).toEqual(fallback);
  });

  it("asks for a connector in a single paragraph and needs a text", () => {
    expect(revisionTaskFor(runWith(null, ["Ein Absatz. Noch ein Satz."]))).toMatchObject({
      instruction: APP_REVISION_TASK_PARAGRAPH.instruction,
      targetQuote: "Ein Absatz. Noch ein Satz.",
    });
    expect(revisionTaskFor(runWith(null, null))).toBeNull();
  });
});

describe("the AI never writes for the student (spec 7.7)", () => {
  const own = paragraphsToText(TEXT);
  const phrases = ["Aus diesen Gründen ...", "Deshalb fordere ich ..."];

  it("accepts feedback that quotes the student or a help card", () => {
    expect(findGhostwriting(textReviewFields(makeTextReview()), own, phrases)).toEqual([]);
    expect(findGhostwriting(['Beginne mit "Deshalb fordere ich" und nenne deinen Standpunkt.'], own, phrases)).toEqual([]);
    expect(findGhostwriting(['Dein Satz "Gestern hatte ich zum Beispiel nur zehn Minuten" ist konkret.'], own, phrases)).toEqual([]);
  });

  it("finds rewrites by phrase, by quoted new wording and by length", () => {
    expect(findGhostwriting(["Du könntest schreiben: Die Pause ist wichtig."], own, phrases)).toHaveLength(1);
    expect(findGhostwriting(['Besser wäre: "Eine längere Pause macht uns alle viel gesünder."'], own, phrases)).toHaveLength(2);
    expect(findGhostwriting([Array.from({ length: 70 }, () => "Wort").join(" ")], own, phrases)).toHaveLength(1);
  });
});

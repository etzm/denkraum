import { describe, expect, it } from "vitest";
import { ampelSchema } from "../schemas/common.ts";
import { exerciseSchema } from "../schemas/exercise.ts";
import { OUTPUT_SCHEMA_NAMES, OUTPUT_SCHEMAS } from "../schemas/output.ts";
import { planReviewSchema } from "../schemas/planReview.ts";
import { planTranscriptSchema } from "../schemas/planTranscript.ts";
import { revisionCheckSchema } from "../schemas/revisionCheck.ts";
import { selfCheckSchema } from "../schemas/selfCheck.ts";
import { textReviewSchema } from "../schemas/textReview.ts";
import { textTranscriptSchema } from "../schemas/textTranscript.ts";
import {
  FULFILLED,
  makePlan,
  makePlanReview,
  makeTextReview,
  makeTextTranscript,
  readJson,
} from "./fixtures.ts";

const words = (n: number) => Array.from({ length: n }, () => "Wort").join(" ");

describe("output schemas (spec 7.4)", () => {
  it("registers the five model outputs by file name", () => {
    expect(OUTPUT_SCHEMA_NAMES).toEqual(["planTranscript", "planReview", "textTranscript", "textReview", "revisionCheck"]);
    expect(OUTPUT_SCHEMAS.planTranscript.safeParse(makePlan()).success).toBe(true);
    expect(OUTPUT_SCHEMAS.planReview.safeParse(makePlanReview()).success).toBe(true);
    expect(OUTPUT_SCHEMAS.textTranscript.safeParse(makeTextTranscript()).success).toBe(true);
    expect(OUTPUT_SCHEMAS.textReview.safeParse(makeTextReview()).success).toBe(true);
    expect(OUTPUT_SCHEMAS.revisionCheck.safeParse(FULFILLED).success).toBe(true);
  });

  it("uses the ampel values gruen, gelb, rot", () => {
    expect(ampelSchema.options).toEqual(["gruen", "gelb", "rot"]);
    expect(planReviewSchema.safeParse(makePlanReview({ criteria: { P1: "grün" as never, P2: "gelb", P3: "rot", P4: "rot", P5: "rot" } })).success).toBe(false);
  });

  it("plan transcript: three arguments, legibility 0 to 1", () => {
    expect(planTranscriptSchema.safeParse(makePlan({ argumente: makePlan().argumente.slice(0, 2) })).success).toBe(false);
    expect(planTranscriptSchema.safeParse(makePlan({ legibility: 1.2 })).success).toBe(false);
    expect(planTranscriptSchema.safeParse(makePlan({ gegenargument: { einwand: "teuer", entkraeftung: "Förderverein" } })).success).toBe(true);
  });

  it("plan review: fixed mirror prefix and at most 80 words for mirror and question", () => {
    expect(planReviewSchema.safeParse(makePlanReview({ mirror: "Dein Plan ist gut." })).success).toBe(false);
    const long = makePlanReview({ mirror: `So habe ich deinen Plan verstanden: ${words(70)}`, question: `${words(10)}?` });
    expect(planReviewSchema.safeParse(long).success).toBe(false);
  });

  it("text transcript: word count is a non-negative integer", () => {
    expect(textTranscriptSchema.safeParse({ ...makeTextTranscript(), word_count: -1 }).success).toBe(false);
  });

  it("text review: stars 0 to 3, two strengths, complete revision task", () => {
    expect(textReviewSchema.safeParse(makeTextReview({ scores: { aufbau: 4 as never, argumentation: 2, sprache: 2, richtigkeit: 2 } })).success).toBe(false);
    expect(textReviewSchema.safeParse(makeTextReview({ strengths: makeTextReview().strengths.slice(0, 1) })).success).toBe(false);
    expect(
      textReviewSchema.safeParse(makeTextReview({ revision_task: { instruction: "", target_quote: "x", help_card_id: "HK-06" } })).success,
    ).toBe(false);
    expect(
      textReviewSchema.safeParse(makeTextReview({ revision_task: { instruction: "x", target_quote: "x", help_card_id: "Karte 6" } })).success,
    ).toBe(false);
  });

  it("text review: a flagged review may leave student fields empty", () => {
    const flagged = makeTextReview({
      strengths: [],
      next_step: "",
      revision_task: { instruction: "", target_quote: "", help_card_id: "" },
      flags: { too_short: false, off_topic: false, inappropriate: true },
    });
    expect(textReviewSchema.safeParse(flagged).success).toBe(true);
  });

  it("text review: at most 140 words in the fields written for the student", () => {
    expect(textReviewSchema.safeParse(makeTextReview({ next_step: words(141) })).success).toBe(false);
    const longQuote = makeTextReview();
    longQuote.lens.these = words(300);
    expect(textReviewSchema.safeParse(longQuote).success).toBe(true);
  });

  it("revision check: one sentence of at most 25 words", () => {
    expect(revisionCheckSchema.safeParse({ fulfilled: true, feedback: words(25) }).success).toBe(true);
    expect(revisionCheckSchema.safeParse({ fulfilled: true, feedback: words(26) }).success).toBe(false);
    expect(revisionCheckSchema.safeParse({ fulfilled: true, feedback: "" }).success).toBe(false);
  });

  it("self check: marks are these or beispiel", () => {
    expect(selfCheckSchema.safeParse({ checkedItemIds: ["bbb"], marks: [{ part: "these", quote: "x" }] }).success).toBe(true);
    expect(selfCheckSchema.safeParse({ checkedItemIds: [], marks: [{ part: "schluss", quote: "x" }] }).success).toBe(false);
  });
});

describe("exercise schema (spec 5)", () => {
  const seed = readJson("content/exercises/seed.json") as Record<string, unknown>[];
  const find = (id: string) => structuredClone(seed.find((e) => e.id === id)!) as { payload: Record<string, unknown> };

  it("accepts the spec example shape with gaps", () => {
    expect(exerciseSchema.safeParse(find("ex-0005")).success).toBe(true);
  });

  it("rejects a correct_order that is not a permutation", () => {
    const e = find("ex-0001");
    e.payload.correct_order = [1, 1, 0, 2];
    expect(exerciseSchema.safeParse(e).success).toBe(false);
  });

  it("rejects a gap count that does not match the text", () => {
    const e = find("ex-0006");
    e.payload.text = "___ sagen manche, dass Social Media hilft.";
    expect(exerciseSchema.safeParse(e).success).toBe(false);
  });

  it("rejects an answer index out of range", () => {
    const e = find("ex-0011");
    e.payload.correct = 3;
    expect(exerciseSchema.safeParse(e).success).toBe(false);
  });

  it("rejects an unknown type", () => {
    expect(exerciseSchema.safeParse({ ...find("ex-0011"), type: "free_text" }).success).toBe(false);
  });
});

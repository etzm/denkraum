import { describe, expect, it } from "vitest";
import { screenText } from "../domain/filter.ts";
import type { MissionRun } from "../domain/state.ts";
import { createRun, replay } from "../domain/state.ts";
import { badgeStats, ghostwritingFindings, runStars } from "../domain/summary.ts";
import { splitSentences } from "../domain/text.ts";
import { filterConfigSchema, rubricSchema } from "../schemas/content.ts";
import { textReviewSchema } from "../schemas/textReview.ts";
import { paragraphsFromText, planFromForm, selfCheckFromForm, textFromForm, type FormFields } from "../server/forms.ts";
import { FULFILLED, makePlan, makePlanReview, makeTextReview, makeTextTranscript, readJson, TEXT } from "./fixtures.ts";

const filter = filterConfigSchema.parse(readJson("content/filter.json"));

function form(values: Record<string, string | string[]>): FormFields {
  return {
    get: (name) => {
      const v = values[name];
      return Array.isArray(v) ? v[0] : (v ?? null);
    },
    getAll: (name) => {
      const v = values[name];
      return v === undefined ? [] : Array.isArray(v) ? v : [v];
    },
  };
}

function completed(review = makeTextReview(), joker?: ReturnType<typeof makeTextReview>): MissionRun {
  const result = replay(createRun({ missionId: "m-04-01", stufe: 4, niveauEEnabled: false }), [
    { type: "BRIEFING_ACK" },
    { type: "PLAN_UPLOADED" },
    { type: "PLAN_TRANSCRIBED", transcript: makePlan() },
    { type: "PLAN_CONFIRMED", plan: makePlan() },
    { type: "PLAN_REVIEWED", review: makePlanReview() },
    { type: "PLAN_FEEDBACK_DONE" },
    { type: "START_WRITING" },
    { type: "TEXT_UPLOADED" },
    { type: "TEXT_TRANSCRIBED", transcript: makeTextTranscript() },
    { type: "TEXT_CONFIRMED", paragraphs: TEXT },
    { type: "SELF_CHECK_SUBMITTED", selfCheck: { checkedItemIds: [], marks: [] } },
    { type: "TEXT_REVIEWED", review },
    ...(joker ? ([{ type: "USE_JOKER", keys: 2 }, { type: "TEXT_REVIEWED", review: joker }] as const) : []),
    { type: "START_REVISION" },
    { type: "REVISION_SUBMITTED", text: "Neu." },
    { type: "REVISION_CHECKED", check: FULFILLED },
  ]);
  if (!result.ok) throw new Error(result.error.reason);
  return result.run;
}

describe("splitSentences", () => {
  it("returns exact substrings of the paragraph", () => {
    for (const paragraph of TEXT) {
      const sentences = splitSentences(paragraph);
      expect(sentences.length).toBeGreaterThan(0);
      for (const s of sentences) expect(paragraph.includes(s)).toBe(true);
    }
    expect(splitSentences("Ich finde das gut! Warum? Weil es hilft")).toEqual(["Ich finde das gut!", "Warum?", "Weil es hilft"]);
    expect(splitSentences("Er sagte: „Komm mit.“ Dann ging er.")).toEqual(["Er sagte: „Komm mit.“", "Dann ging er."]);
    expect(splitSentences("   ")).toEqual([]);
  });
});

describe("input filter", () => {
  it("flags listed terms with word boundaries and stems, not similar words", () => {
    expect(screenText("Alle hassen mich in der Klasse.", filter)).toEqual({ flagged: true, categories: ["mobbing"] });
    expect(screenText("Er ist so ein Spasti.", filter).categories).toEqual(["beleidigung"]);
    expect(screenText("Ich mache einen Vorschlag zum Schlagzeug.", filter).flagged).toBe(false);
    expect(screenText("Die Handys sind ein Problem, weil wir abgelenkt werden.", filter).flagged).toBe(false);
  });

  it("validates the rubric with both variants", () => {
    const rubric = rubricSchema.parse(readJson("content/rubric.json"));
    expect(Object.keys(rubric.variants)).toEqual(["satz_absatz", "text"]);
  });
});

describe("runStars", () => {
  it("summarises the review with dimension D from the error count", () => {
    const stars = runStars(completed(makeTextReview({ error_density: 6 })));
    expect(stars).toMatchObject({ scores: { aufbau: 2, argumentation: 2, sprache: 2, richtigkeit: 1 }, base: 7 });
  });

  it("keeps the better pass after a joker", () => {
    const low = makeTextReview({ scores: { aufbau: 1, argumentation: 1, sprache: 1, richtigkeit: 3 } });
    const high = makeTextReview({ scores: { aufbau: 3, argumentation: 3, sprache: 3, richtigkeit: 3 } });
    expect(runStars(completed(high, low))!.scores.aufbau).toBe(3);
    expect(runStars(completed(low, high))!.scores.aufbau).toBe(3);
  });

  it("counts badges from runs", () => {
    const run = completed(makeTextReview({ scores: { aufbau: 2, argumentation: 2, sprache: 3, richtigkeit: 3 } }));
    const stats = badgeStats([run], { streakDays: 2, correctCompleteBbb: 1 });
    expect(stats).toMatchObject({ plansApprovedFirstTry: 1, claimsWithReason: 4, missionsWithSpracheThree: 1, revisionsFulfilled: 1 });
    expect(stats.missionsWithExampleForEveryArgument).toBe(1);
  });
});

describe("ghostwriting check", () => {
  it("passes the regular review", () => {
    expect(ghostwritingFindings(makeTextReview(), TEXT)).toEqual([]);
  });

  it("finds suggested sentences and long quotes that are not the child's words", () => {
    const bad = textReviewSchema.parse(
      makeTextReview({
        next_step: "Du könntest schreiben: Außerdem ist die Pause wichtig.",
        revision_task: {
          instruction: "Ersetze den Schluss durch „Deshalb fordere ich eine längere Pause für alle Klassen“.",
          target_quote: "Aus diesen Gründen bitte ich die Schulkonferenz, die Mittagspause zu verlängern.",
          help_card_id: "HK-06",
        },
      }),
    );
    expect(ghostwritingFindings(bad, TEXT)).toHaveLength(2);
    // Quoting the child's own sentence is fine.
    const own = makeTextReview({ next_step: "Dein Satz „Im Moment müssen viele schnell essen, weil die Schlange in der Mensa lang ist“ ist stark." });
    expect(ghostwritingFindings(own, TEXT)).toEqual([]);
  });
});

describe("forms", () => {
  it("reads the typed planning sheet with the same boxes as on paper", () => {
    const result = planFromForm(
      form({ thema: " Pause ", standpunkt: "dafür", a1_behauptung: "Zeit", a1_begruendung: "weil", a1_beispiel: "gestern", schluss: "Bitte" }),
      "planning_sheet",
      false,
    );
    expect(result.ok && result.event.type === "PLAN_TYPED" && result.event.plan).toMatchObject({
      thema: "Pause",
      standpunkt: "dafür",
      argumente: [{ behauptung: "Zeit", begruendung: "weil", beispiel: "gestern" }, { behauptung: "" }, { behauptung: "" }],
      legibility: 1,
    });
  });

  it("uses only the first argument on the paragraph template", () => {
    const result = planFromForm(form({ standpunkt: "x", a1_behauptung: "A", a2_behauptung: "B" }), "paragraph_template", false);
    expect(result.ok && result.event.type === "PLAN_TYPED" && result.event.plan).toMatchObject({
      standpunkt: "",
      argumente: [{ behauptung: "A" }, { behauptung: "" }, { behauptung: "" }],
    });
  });

  it("splits typed text into paragraphs at empty lines", () => {
    expect(paragraphsFromText("Erster  Satz.\nNoch einer.\n\n\nZweiter Absatz.\r\n \r\nDritter.")).toEqual([
      "Erster Satz. Noch einer.",
      "Zweiter Absatz.",
      "Dritter.",
    ]);
    expect(textFromForm(form({ text: "" }))).toEqual({ ok: true, event: { type: "TEXT_TYPED", paragraphs: [""] } });
    expect(textFromForm(form({ text: "x".repeat(13_000) }))).toEqual({ ok: false, error: "too_long" });
  });

  it("collects checklist items and marked sentences", () => {
    const result = selfCheckFromForm(form({ check: ["einleitung", "bbb"], these: "Ich bin dafür.", beispiel: ["Gestern.", "Heute."] }));
    expect(result).toEqual({
      ok: true,
      event: {
        type: "SELF_CHECK_SUBMITTED",
        selfCheck: {
          checkedItemIds: ["einleitung", "bbb"],
          marks: [
            { part: "these", quote: "Ich bin dafür." },
            { part: "beispiel", quote: "Gestern." },
            { part: "beispiel", quote: "Heute." },
          ],
        },
      },
    });
  });
});

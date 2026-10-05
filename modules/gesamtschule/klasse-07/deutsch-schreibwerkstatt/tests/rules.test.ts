import { describe, expect, it } from "vitest";
import type { HelpCard } from "../schemas/content.ts";
import { helpCardFileSchema } from "../schemas/content.ts";
import type { CompletionFacts, ProgressContext, Scores, StarSummary } from "../domain/rules.ts";
import {
  addDays,
  BADGES,
  berlinDay,
  betterStars,
  bossTimeLeftMs,
  canUseJoker,
  checkMissionStart,
  computeStars,
  countArgumentsWithReason,
  currentStufe,
  earnedBadges,
  editDistanceCheck,
  everyArgumentHasExample,
  helpCardCost,
  helpCardsForMission,
  isBossStartable,
  isEPathSuggested,
  isHelpCardAvailable,
  isMissionCompleted,
  isStageCompleted,
  isStageVisible,
  minWordsFor,
  planGate,
  registerActivity,
  richtigkeitStars,
  stagePath,
  stationRewards,
  suggestRetake,
  unlockHelpCard,
  XP,
} from "../domain/rules.ts";
import { countWords, isFilled, levenshtein } from "../domain/text.ts";
import { approvedMissions, makeParagraphPlan, makePlan, makeTextReview, makeWeakPlan, readJson } from "./fixtures.ts";

const missions = approvedMissions();
const byId = (id: string) => missions.find((m) => m.id === id)!;
const cards = helpCardFileSchema.parse(readJson("content/help_cards.json"));
const card = (id: string): HelpCard => cards.find((c) => c.id === id)!;

const M_STAGES_DONE = ["m-01-01", "m-01-02", "m-02-01", "m-02-02", "m-03-01", "m-03-02", "m-04-01", "m-04-02", "m-05-01", "m-05-02"];

function ctx(overrides: Partial<ProgressContext> = {}): ProgressContext {
  return { niveauEEnabled: false, completedMissionIds: [], passedStationIds: [], ...overrides };
}

describe("stages", () => {
  it("shows stage 6 only on Niveau E", () => {
    expect(stagePath(false)).toEqual([1, 2, 3, 4, 5, "boss"]);
    expect(stagePath(true)).toEqual([1, 2, 3, 4, 5, 6, "boss"]);
    expect(isStageVisible(6, false)).toBe(false);
    expect(isStageVisible(6, true)).toBe(true);
    expect(isStageVisible(5, false)).toBe(true);
  });

  it("advances after two completed missions of the stage", () => {
    expect(isStageCompleted(4, missions, ["m-04-01"])).toBe(false);
    expect(isStageCompleted(4, missions, ["m-04-01", "m-04-03"])).toBe(true);
    expect(currentStufe(missions, ctx())).toBe(1);
    expect(currentStufe(missions, ctx({ completedMissionIds: ["m-01-01"] }))).toBe(1);
    expect(currentStufe(missions, ctx({ completedMissionIds: ["m-01-01", "m-01-02"] }))).toBe(2);
  });

  it("leads to the boss after stage 5 on M and after stage 6 on E", () => {
    expect(currentStufe(missions, ctx({ completedMissionIds: M_STAGES_DONE }))).toBe("boss");
    expect(isBossStartable(missions, ctx({ completedMissionIds: M_STAGES_DONE }))).toBe(true);
    const e = ctx({ completedMissionIds: M_STAGES_DONE, niveauEEnabled: true });
    expect(currentStufe(missions, e)).toBe(6);
    expect(isBossStartable(missions, e)).toBe(false);
    const eDone = ctx({ completedMissionIds: [...M_STAGES_DONE, "m-06-01", "m-06-02"], niveauEEnabled: true });
    expect(isBossStartable(missions, eDone)).toBe(true);
  });
});

describe("checkMissionStart", () => {
  it("needs the station before the mission", () => {
    expect(checkMissionStart(byId("m-01-01"), missions, ctx()).blockers).toEqual(["station_not_passed"]);
    expect(checkMissionStart(byId("m-01-01"), missions, ctx({ passedStationIds: ["st-01-01"] })).startable).toBe(true);
  });

  it("needs the previous mission of the stage", () => {
    const c = ctx({ passedStationIds: ["st-01-01", "st-01-02"] });
    expect(checkMissionStart(byId("m-01-02"), missions, c).blockers).toEqual(["previous_mission_open"]);
    expect(checkMissionStart(byId("m-01-02"), missions, { ...c, completedMissionIds: ["m-01-01"] }).startable).toBe(true);
  });

  it("locks later stages and stage 6 without Niveau E", () => {
    expect(checkMissionStart(byId("m-02-01"), missions, ctx({ passedStationIds: ["st-02-01"] })).blockers).toEqual([
      "stage_locked",
    ]);
    const c = ctx({ completedMissionIds: M_STAGES_DONE, passedStationIds: ["st-06-01"] });
    expect(checkMissionStart(byId("m-06-01"), missions, c).blockers).toEqual(["niveau_e_required"]);
    expect(checkMissionStart(byId("m-06-01"), missions, { ...c, niveauEEnabled: true }).startable).toBe(true);
  });

  it("starts only content approved by the teacher", () => {
    const unapproved = { ...byId("m-01-01"), approved: false };
    expect(checkMissionStart(unapproved, missions, ctx({ passedStationIds: ["st-01-01"] })).blockers).toEqual([
      "not_approved",
    ]);
  });

  it("allows restarting a completed mission", () => {
    const c = ctx({ completedMissionIds: ["m-01-01"], passedStationIds: ["st-01-01"] });
    expect(checkMissionStart(byId("m-01-01"), missions, c).startable).toBe(true);
  });

  it("starts the boss only when the path is completed", () => {
    expect(checkMissionStart(byId("boss-01"), missions, ctx()).blockers).toEqual(["stage_locked"]);
    expect(checkMissionStart(byId("boss-01"), missions, ctx({ completedMissionIds: M_STAGES_DONE })).startable).toBe(true);
  });
});

describe("isMissionCompleted", () => {
  const done: CompletionFacts = {
    textConfirmed: true,
    wordCount: 97,
    minWords: 80,
    selfCheckSubmitted: true,
    revisionAttempts: 1,
    revisionFulfilled: true,
  };

  it("is true when all code-checkable facts hold", () => {
    expect(isMissionCompleted(done)).toBe(true);
  });

  it("needs every fact", () => {
    expect(isMissionCompleted({ ...done, textConfirmed: false })).toBe(false);
    expect(isMissionCompleted({ ...done, wordCount: 79 })).toBe(false);
    expect(isMissionCompleted({ ...done, selfCheckSubmitted: false })).toBe(false);
    expect(isMissionCompleted({ ...done, revisionAttempts: 0, revisionFulfilled: null })).toBe(false);
  });

  it("never blocks on the revision check: a second attempt is enough", () => {
    expect(isMissionCompleted({ ...done, revisionFulfilled: false })).toBe(false);
    expect(isMissionCompleted({ ...done, revisionAttempts: 2, revisionFulfilled: false })).toBe(true);
  });

  it("asks 80 words from stage 3 on, only a non-empty text on stages 1 and 2", () => {
    expect(minWordsFor(1)).toBe(1);
    expect(minWordsFor(2)).toBe(1);
    for (const s of [3, 4, 5, 6, "boss"] as const) expect(minWordsFor(s)).toBe(80);
  });
});

describe("stars never gate", () => {
  it("no gating rule takes stars as input", () => {
    // Gates read ProgressContext and CompletionFacts only; neither has a star field.
    const keys = [...Object.keys(ctx()), "textConfirmed", "wordCount", "minWords", "selfCheckSubmitted", "revisionAttempts", "revisionFulfilled"];
    for (const k of keys) expect(k).not.toMatch(/star|score|aufbau|sprache|richtigkeit|argumentation/i);
  });

  it("a stage counts as completed with zero-star missions", () => {
    // Completion is recorded by the state machine from code facts (see state.test.ts);
    // the unlock rules then only see mission ids.
    expect(isStageCompleted(1, missions, ["m-01-01", "m-01-02"])).toBe(true);
  });
});

describe("planGate", () => {
  it("approves a stance plus two arguments with a reason", () => {
    expect(planGate(makePlan(), "planning_sheet")).toEqual({ approved: true, missing: [] });
    expect(countArgumentsWithReason(makePlan())).toBe(3);
  });

  it("names what is missing", () => {
    expect(planGate(makeWeakPlan(), "planning_sheet")).toEqual({
      approved: false,
      missing: ["standpunkt", "zwei_argumente_mit_begruendung"],
    });
  });

  it("treats illegible markers as empty", () => {
    expect(isFilled("[?] [?]")).toBe(false);
    expect(isFilled("[Pause?]")).toBe(true);
    expect(planGate(makePlan({ standpunkt: "[?]" }), "planning_sheet").missing).toEqual(["standpunkt"]);
  });

  it("needs one argument with a reason on the paragraph template", () => {
    expect(planGate(makeParagraphPlan(), "paragraph_template").approved).toBe(true);
    expect(planGate(makeParagraphPlan(), "planning_sheet").approved).toBe(false);
    expect(planGate(makePlan({ argumente: makeWeakPlan().argumente.map((a) => ({ ...a, begruendung: "" })) }), "paragraph_template").missing).toEqual([
      "argument_mit_begruendung",
    ]);
  });
});

describe("transcription checks", () => {
  it("computes a normalized Levenshtein distance", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("Gr\u00fcnde", "Gru\u0308nde")).toBe(0);
    expect(editDistanceCheck("", "")).toEqual({ ratio: 0, flagged: false });
  });

  it("flags more than 25 percent changes, but only flags", () => {
    expect(editDistanceCheck("Ich finde Pausen gut.", "Ich finde Pausen gut.").flagged).toBe(false);
    expect(editDistanceCheck("Ich fnde Pausen gut.", "Ich finde Pausen gut.").flagged).toBe(false);
    const big = editDistanceCheck("Ich finde Pausen gut.", "Wir brauchen mehr Sport.");
    expect(big.ratio).toBeGreaterThan(0.25);
    expect(big.flagged).toBe(true);
  });

  it("asks for a new photo below legibility 0.5", () => {
    expect(suggestRetake(0.49)).toBe(true);
    expect(suggestRetake(0.5)).toBe(false);
  });

  it("counts words including illegible markers", () => {
    expect(countWords("Ich finde [?] gut , weil ...")).toBe(5);
    expect(countWords("  ")).toBe(0);
  });
});

describe("stars (formative)", () => {
  const all = (n: 0 | 1 | 2 | 3): Scores => ({ aufbau: n, argumentation: n, sprache: n, richtigkeit: n });

  it("maps errors per 100 words to rubric D", () => {
    expect([0, 1, 1.5, 4, 4.1, 8, 8.1].map(richtigkeitStars)).toEqual([3, 3, 2, 2, 1, 1, 0]);
  });

  it("takes D from the passed-in error count, not from the model's D stars", () => {
    const review = makeTextReview({ scores: { aufbau: 3, argumentation: 3, sprache: 3, richtigkeit: 0 } });
    const s = computeStars({
      ai: review,
      richtigkeit: { errorsPer100Words: 0.5, source: "languagetool" },
      niveauEEnabled: false,
      stufe: 4,
      typedFallback: false,
    });
    expect(s.scores.richtigkeit).toBe(3);
    expect(s.base).toBe(12);
  });

  it("counts E bonus stars only on Niveau E", () => {
    const review = makeTextReview({
      e_bonus: { gegenargument_genannt: true, gegenargument_entkraeftet: true, schlussregel: false },
    });
    const input = { ai: review, richtigkeit: { errorsPer100Words: 0, source: "ai_review" as const }, stufe: 6 as const, typedFallback: false };
    expect(computeStars({ ...input, niveauEEnabled: true }).bonus).toBe(2);
    expect(computeStars({ ...input, niveauEEnabled: false }).bonus).toBe(0);
  });

  it("caps a typed fallback at 10 stars on stages 4 and 6 for display", () => {
    const review = makeTextReview({ scores: all(3) });
    const run = (stufe: 3 | 4 | 6 | "boss", typedFallback: boolean) =>
      computeStars({ ai: review, richtigkeit: { errorsPer100Words: 0, source: "ai_review" }, niveauEEnabled: false, stufe, typedFallback });
    expect(run(4, true)).toMatchObject({ base: 12, display: 10, capped: true });
    expect(run(6, true)).toMatchObject({ display: 10, capped: true });
    expect(run(4, false)).toMatchObject({ display: 12, capped: false });
    expect(run(3, true)).toMatchObject({ display: 12, capped: false });
    expect(run("boss", true)).toMatchObject({ display: 12, capped: false });
  });

  it("keeps the better of two passes, never the sum", () => {
    const summary = (display: number, bonus = 0): StarSummary => ({ scores: all(0), base: display, bonus, display, capped: false });
    const first = summary(7);
    const second = summary(9);
    expect(betterStars(first, second)).toBe(second);
    expect(betterStars(second, first)).toBe(second);
    const tie = summary(7);
    expect(betterStars(first, tie)).toBe(first);
    expect(betterStars(summary(9), summary(8, 2))).toMatchObject({ display: 8, bonus: 2 });
  });
});

describe("Niveau E suggestion", () => {
  const good: Scores = { aufbau: 3, argumentation: 3, sprache: 2, richtigkeit: 2 };
  const weakDim: Scores = { aufbau: 3, argumentation: 3, sprache: 3, richtigkeit: 1 };
  const low: Scores = { aufbau: 2, argumentation: 2, sprache: 2, richtigkeit: 3 };

  it("suggests after two stage 4 missions in a row with 10 of 12 and no dimension below 2", () => {
    expect(isEPathSuggested([good, good])).toBe(true);
    expect(isEPathSuggested([low, good, good])).toBe(true);
  });

  it("does not suggest earlier", () => {
    expect(isEPathSuggested([good])).toBe(false);
    expect(isEPathSuggested([good, low, good])).toBe(false);
    expect(isEPathSuggested([good, weakDim])).toBe(false);
  });
});

describe("keys, joker, help cards", () => {
  it("joker costs 2 keys, at most one per mission", () => {
    expect(canUseJoker({ keys: 2, jokerUsed: false })).toBe(true);
    expect(canUseJoker({ keys: 1, jokerUsed: false })).toBe(false);
    expect(canUseJoker({ keys: 5, jokerUsed: true })).toBe(false);
  });

  it("help cards cost a key on their stage and are free after advancing", () => {
    expect(helpCardCost(card("HK-04"), 2)).toBe(1);
    expect(helpCardCost(card("HK-04"), 1)).toBe(1);
    expect(helpCardCost(card("HK-04"), 3)).toBe(0);
    expect(helpCardCost(card("HK-06"), "boss")).toBe(0);
  });

  it("unlocks with keys", () => {
    const base = { currentStufe: 3 as const, unlockedIds: [], niveauEEnabled: false };
    expect(unlockHelpCard(card("HK-01"), { ...base, keys: 1 })).toEqual({ ok: true, keysLeft: 0 });
    expect(unlockHelpCard(card("HK-01"), { ...base, keys: 0 })).toEqual({ ok: false, reason: "not_enough_keys" });
    expect(unlockHelpCard(card("HK-01"), { ...base, keys: 1, unlockedIds: ["HK-01"] })).toEqual({
      ok: false,
      reason: "already_available",
    });
    expect(unlockHelpCard(card("HK-02"), { ...base, keys: 1 })).toEqual({ ok: false, reason: "already_available" });
    expect(unlockHelpCard(card("HK-07"), { ...base, keys: 1 })).toEqual({ ok: false, reason: "niveau_e_required" });
  });

  it("offers HK-07 only on Niveau E", () => {
    const c = { currentStufe: "boss" as const, unlockedIds: [], niveauEEnabled: false };
    expect(isHelpCardAvailable(card("HK-07"), c)).toBe(false);
    expect(isHelpCardAvailable(card("HK-07"), { ...c, niveauEEnabled: true })).toBe(true);
  });

  it("shows no help cards in the boss mission", () => {
    const c = { currentStufe: "boss" as const, unlockedIds: [], niveauEEnabled: false };
    expect(helpCardsForMission(byId("boss-01"), cards, c)).toEqual([]);
    expect(helpCardsForMission(byId("m-04-01"), cards, c).map((h) => h.id)).toEqual(["HK-01", "HK-05", "HK-06", "HK-09"]);
  });
});

describe("XP and rewards", () => {
  it("uses fixed values independent of AI judgments", () => {
    expect(XP).toEqual({ missionCompleted: 100, stationPassed: 15, revisionSubmitted: 20, streakDay: 10 });
  });

  it("gives a key only for the first pass of a station", () => {
    expect(stationRewards({ passed: true, firstPass: true })).toEqual({ keys: 1, xp: 15 });
    expect(stationRewards({ passed: true, firstPass: false })).toEqual({ keys: 0, xp: 15 });
    expect(stationRewards({ passed: false, firstPass: true })).toEqual({ keys: 0, xp: 0 });
  });
});

describe("streak by Berlin calendar date", () => {
  it("uses the local date in Europe/Berlin", () => {
    expect(berlinDay(new Date("2026-10-05T21:59:00Z"))).toBe("2026-10-05");
    expect(berlinDay(new Date("2026-10-05T22:00:00Z"))).toBe("2026-10-06");
    expect(berlinDay(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("counts days, not sessions", () => {
    const first = registerActivity({ days: 0, lastActiveDay: null }, new Date("2026-10-05T08:00:00Z"));
    expect(first).toEqual({ streak: { days: 1, lastActiveDay: "2026-10-05" }, newDay: true, xp: 10 });
    const same = registerActivity(first.streak, new Date("2026-10-05T18:00:00Z"));
    expect(same).toEqual({ streak: first.streak, newDay: false, xp: 0 });
    const next = registerActivity(first.streak, new Date("2026-10-05T22:30:00Z"));
    expect(next.streak).toEqual({ days: 2, lastActiveDay: "2026-10-06" });
    const gap = registerActivity(next.streak, new Date("2026-10-08T10:00:00Z"));
    expect(gap.streak).toEqual({ days: 1, lastActiveDay: "2026-10-08" });
  });

  it("continues across the switch to winter time", () => {
    const sat = registerActivity({ days: 3, lastActiveDay: null }, new Date("2026-10-24T12:00:00Z"));
    const sunLate = registerActivity(sat.streak, new Date("2026-10-25T22:30:00Z"));
    expect(sunLate.streak).toEqual({ days: 2, lastActiveDay: "2026-10-25" });
  });
});

describe("boss timer", () => {
  it("runs 45 minutes from the stored start", () => {
    const start = new Date("2026-10-05T10:00:00Z");
    expect(bossTimeLeftMs(start, new Date("2026-10-05T10:15:00Z"))).toBe(30 * 60_000);
    expect(bossTimeLeftMs(start, new Date("2026-10-05T11:00:00Z"))).toBe(0);
  });
});

describe("badges", () => {
  const none = {
    plansApprovedFirstTry: 0,
    claimsWithReason: 0,
    missionsWithExampleForEveryArgument: 0,
    missionsWithSpracheThree: 0,
    revisionsFulfilled: 0,
    missionsWithRebuttal: 0,
    streakDays: 0,
  };

  it("applies the thresholds of spec 3.3", () => {
    expect(earnedBadges(none)).toEqual([]);
    expect(
      earnedBadges({
        plansApprovedFirstTry: 3,
        claimsWithReason: 10,
        missionsWithExampleForEveryArgument: 3,
        missionsWithSpracheThree: 2,
        revisionsFulfilled: 5,
        missionsWithRebuttal: 1,
        streakDays: 7,
      }),
    ).toEqual(["planer", "behauptungs_profi", "beispiel_jaeger", "verknuepfer", "ueberarbeiter", "die_andere_seite", "durchhalter"]);
    expect(earnedBadges({ ...none, plansApprovedFirstTry: 2, streakDays: 6, missionsWithSpracheThree: 1 })).toEqual([]);
  });

  it("documents which badges read AI output", () => {
    expect(BADGES.verknuepfer.source).toBe("ai_formative");
    expect(BADGES.planer.source).toBe("code");
  });

  it("checks examples in the Textlupe", () => {
    expect(everyArgumentHasExample(makeTextReview().lens)).toBe(true);
    const lens = makeTextReview().lens;
    expect(everyArgumentHasExample({ ...lens, argumente: [{ ...lens.argumente[0]!, beispiel: "" }] })).toBe(false);
    expect(everyArgumentHasExample({ ...lens, argumente: [] })).toBe(false);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { GardenInput, GardenRun } from "../domain/garden.ts";
import {
  bloomColor,
  builtHouseParts,
  gardenBeds,
  gardenView,
  gardenVisitors,
  gardenVitality,
  houseBadges,
  inactiveDays,
  isFerien,
  plantRank,
  plantStage,
  skyFor,
  sunnyDays,
  varietyFor,
} from "../domain/garden.ts";
import type { MissionEvent, MissionRun } from "../domain/state.ts";
import { createRun, replay, transition } from "../domain/state.ts";
import type { Stufe } from "../schemas/common.ts";
import type { GardenConfig } from "../schemas/garden.ts";
import { gardenConfigSchema, HOUSE_PARTS, PLANT_STAGES } from "../schemas/garden.ts";
import type { SelfCheck } from "../schemas/selfCheck.ts";
import {
  approvedMissions,
  FULFILLED,
  makePlan,
  makePlanReview,
  makeTextReview,
  makeTextTranscript,
  makeWeakPlan,
  MODULE_ROOT,
  readJson,
  TEXT,
} from "./fixtures.ts";

const config: GardenConfig = gardenConfigSchema.parse(readJson("content/garden.json"));
const missions = approvedMissions();
const stufeOf = (missionId: string): Stufe => missions.find((m) => m.id === missionId)!.stufe;

const selfCheck: SelfCheck = {
  checkedItemIds: ["einleitung"],
  marks: [{ part: "these", quote: "Ich bin der Meinung, dass wir eine längere Mittagspause brauchen." }],
};

const PAPER_PLAN: MissionEvent[] = [
  { type: "BRIEFING_ACK" },
  { type: "PLAN_UPLOADED" },
  { type: "PLAN_TRANSCRIBED", transcript: makePlan() },
  { type: "PLAN_CONFIRMED", plan: makePlan() },
  { type: "PLAN_REVIEWED", review: makePlanReview() },
  { type: "PLAN_FEEDBACK_DONE" },
  { type: "START_WRITING" },
];
const PAPER_TEXT: MissionEvent[] = [
  { type: "TEXT_UPLOADED" },
  { type: "TEXT_TRANSCRIBED", transcript: makeTextTranscript() },
  { type: "TEXT_CONFIRMED", paragraphs: TEXT },
];
const FEEDBACK_AND_REVISION: MissionEvent[] = [
  { type: "SELF_CHECK_SUBMITTED", selfCheck },
  { type: "TEXT_REVIEWED", review: makeTextReview() },
  { type: "START_REVISION" },
  { type: "REVISION_SUBMITTED", text: "Aus diesen Gründen bin ich für eine längere Mittagspause." },
  { type: "REVISION_CHECKED", check: FULFILLED },
];

/** Applies events one by one and returns every intermediate run, failing the test on an error. */
function walk(start: MissionRun, events: readonly MissionEvent[]): MissionRun[] {
  const runs = [start];
  for (const event of events) {
    const result = transition(runs.at(-1)!, event);
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.reason}`);
    runs.push(result.run);
  }
  return runs;
}

/** A completed run for garden tests that only need the outcome. */
function done(missionId: string, runId = `run-${missionId}`): GardenRun {
  return { runId, run: { ...createRun({ missionId, stufe: stufeOf(missionId), niveauEEnabled: false }), state: "completed" } };
}

function open(missionId: string, runId = `open-${missionId}`): GardenRun {
  return { runId, run: createRun({ missionId, stufe: stufeOf(missionId), niveauEEnabled: false }) };
}

const M_PATH = ["m-01-01", "m-01-02", "m-02-01", "m-02-02", "m-03-01", "m-03-02", "m-04-01", "m-04-02", "m-05-01", "m-05-02"];

function input(overrides: Partial<GardenInput> = {}): GardenInput {
  return {
    today: "2026-11-04",
    missions,
    runs: [],
    niveauEEnabled: false,
    ePathSuggested: false,
    passedStationIds: [],
    streak: { days: 0, lastActiveDay: null },
    lastActiveDay: null,
    badges: [],
    availableHelpCardIds: [],
    config,
    ...overrides,
  };
}

describe("garden config", () => {
  it("validates and lists the KMK holidays 2026/27 in order", () => {
    expect(config.ferien.length).toBeGreaterThanOrEqual(5);
    const starts = config.ferien.map((f) => f.from);
    expect([...starts].sort()).toEqual(starts);
    for (let i = 1; i < config.ferien.length; i++) expect(config.ferien[i - 1]!.to < config.ferien[i]!.from).toBe(true);
    expect(isFerien("2026-10-28", config)).toBe(true);
    expect(isFerien("2026-12-23", config)).toBe(true);
    expect(isFerien("2027-01-09", config)).toBe(true);
    expect(isFerien("2027-01-11", config)).toBe(false);
  });

  it("has a variety for every stage and a label for every stage, part and visitor", () => {
    for (const s of [1, 2, 3, 4, 5, 6, "boss"] as const) expect(varietyFor(s, config).colors.length).toBeGreaterThan(0);
    for (const s of PLANT_STAGES) expect(config.labels.plantStages[s]).toBeTruthy();
    for (const p of HOUSE_PARTS) expect(config.labels.houseParts[p]).toBeTruthy();
  });

  it("names the way back in every message that is not fresh", () => {
    for (const level of ["thirsty", "wilted", "dormant"] as const) expect(config.messages[level]).toMatch(/Station/);
    const shaming = /schlecht|faul|versagt|tot|gestorben|verloren|Schande/i;
    for (const m of Object.values(config.messages)) expect(m).not.toMatch(shaming);
  });
});

describe("plant stages", () => {
  it("grows through every step of a stage 4 mission and blooms when completed", () => {
    const runs = walk(createRun({ missionId: "m-04-01", stufe: 4, niveauEEnabled: false }), [
      ...PAPER_PLAN,
      ...PAPER_TEXT,
      ...FEEDBACK_AND_REVISION,
    ]);
    const stages = runs.map(plantStage);
    expect(stages[0]).toBe("seed");
    expect(stages[1]).toBe("sown");
    // PLAN_FEEDBACK_DONE approves the plan.
    expect(stages[6]).toBe("sprout");
    // TEXT_CONFIRMED with enough words.
    expect(stages[10]).toBe("leaves");
    expect(stages[11]).toBe("bud");
    expect(stages.at(-1)).toBe("bloom");
  });

  it("never shrinks, through revision rounds, retakes, a too short text and a hold", () => {
    const shortText = ["Ich bin für eine längere Pause."];
    const events: MissionEvent[] = [
      { type: "BRIEFING_ACK" },
      { type: "PLAN_TYPED", plan: makeWeakPlan() },
      { type: "PLAN_REVIEWED", review: makePlanReview({ approved: false }) },
      { type: "PLAN_FEEDBACK_DONE" },
      { type: "PLAN_UPLOADED" },
      { type: "TRANSCRIPTION_FAILED" },
      { type: "TRANSCRIPTION_FAILED" },
      { type: "PLAN_TYPED", plan: makePlan() },
      { type: "CONTENT_FLAGGED" },
      { type: "ADULT_RELEASED" },
      { type: "PLAN_REVIEWED", review: makePlanReview() },
      { type: "PLAN_FEEDBACK_DONE" },
      { type: "START_WRITING" },
      { type: "TEXT_TYPED", paragraphs: shortText },
      { type: "TEXT_UPLOADED" },
      { type: "TEXT_TRANSCRIBED", transcript: makeTextTranscript() },
      { type: "RETAKE_PHOTO" },
      ...PAPER_TEXT,
      { type: "SELF_CHECK_SUBMITTED", selfCheck },
      { type: "CONTENT_FLAGGED" },
      { type: "ADULT_RELEASED" },
      ...FEEDBACK_AND_REVISION.slice(1),
    ];
    const runs = walk(createRun({ missionId: "m-04-01", stufe: 4, niveauEEnabled: false }), events);
    const ranks = runs.map((r) => plantRank(plantStage(r)));
    for (let i = 1; i < ranks.length; i++) expect(ranks[i]!).toBeGreaterThanOrEqual(ranks[i - 1]!);
    // A too short text does not count as leaves yet.
    expect(plantStage(runs[14]!)).toBe("sprout");
    // Held for an adult in plan feedback: the plant waits as it was.
    expect(runs[9]!.state).toBe("held_for_adult");
    expect(plantStage(runs[9]!)).toBe("sown");
    expect(plantStage(runs.at(-1)!)).toBe("bloom");
  });

  it("sprouts after the maximum plan rounds even without the code gate", () => {
    const weak: MissionEvent[] = [
      { type: "PLAN_TYPED", plan: makeWeakPlan() },
      { type: "PLAN_REVIEWED", review: makePlanReview({ approved: false }) },
      { type: "PLAN_FEEDBACK_DONE" },
    ];
    const result = replay(createRun({ missionId: "m-04-01", stufe: 4, niveauEEnabled: false }), [
      { type: "BRIEFING_ACK" },
      ...weak,
      ...weak,
      ...weak,
    ]);
    if (!result.ok) throw new Error(result.error.reason);
    expect(result.run.state).toBe("plan_approved");
    expect(plantStage(result.run)).toBe("sprout");
  });

  it("lets stage 1 sprout on the first written attempt, without a plan", () => {
    const runs = walk(createRun({ missionId: "m-01-01", stufe: 1, niveauEEnabled: false }), [
      { type: "BRIEFING_ACK" },
      { type: "TEXT_TYPED", paragraphs: [""] },
      { type: "TEXT_TYPED", paragraphs: ["Hausaufgaben am Wochenende sind schlecht, weil wir uns erholen müssen."] },
    ]);
    expect(runs.map(plantStage)).toEqual(["seed", "sown", "sprout", "leaves"]);
  });
});

describe("vitality: wilts, never dies", () => {
  // 2 November 2026 is a Monday outside the holidays.
  const last = "2026-11-02";

  it("follows the thresholds on school days and plateaus at dormant", () => {
    const at = (today: string) => gardenVitality(last, today, config);
    expect(at("2026-11-02")).toMatchObject({ level: "fresh", inactiveDays: 0 });
    expect(at("2026-11-03")).toMatchObject({ level: "fresh", inactiveDays: 1 });
    expect(at("2026-11-04")).toMatchObject({ level: "thirsty", inactiveDays: 2 });
    expect(at("2026-11-05")).toMatchObject({ level: "thirsty", inactiveDays: 3 });
    expect(at("2026-11-06")).toMatchObject({ level: "wilted", inactiveDays: 4 });
    // The weekend does not count: Monday 9 November is the 5th day.
    expect(at("2026-11-09")).toMatchObject({ level: "wilted", inactiveDays: 5 });
    expect(at("2026-11-11")).toMatchObject({ level: "wilted", inactiveDays: 7 });
    expect(at("2026-11-12")).toMatchObject({ level: "dormant", inactiveDays: 8 });
    // Months later it is still only dormant: no further decay, nothing lost.
    expect(at("2027-03-01")).toMatchObject({ level: "dormant", inactiveDays: 8 });
  });

  it("does not count weekends unless configured", () => {
    expect(inactiveDays("2026-11-06", "2026-11-09", config)).toBe(1);
    const weekends = { ...config, vitality: { ...config.vitality, countWeekends: true } };
    expect(inactiveDays("2026-11-06", "2026-11-09", weekends)).toBe(3);
  });

  it("pauses in the holidays", () => {
    // Friday before the Herbstferien to the Monday after: only that Monday counts.
    expect(gardenVitality("2026-10-23", "2026-11-02", config)).toMatchObject({ level: "fresh", inactiveDays: 1 });
    // Christmas: 23 December to 9 January rest.
    expect(gardenVitality("2026-12-22", "2027-01-11", config)).toMatchObject({ level: "fresh", inactiveDays: 1 });
    expect(gardenVitality("2026-10-23", "2026-10-28", config)).toMatchObject({ level: "fresh", ferien: true });
  });

  it("is fresh again right after an activity, and fresh before the first one", () => {
    expect(gardenVitality("2027-03-01", "2027-03-01", config).level).toBe("fresh");
    expect(gardenVitality(null, "2027-03-01", config)).toMatchObject({ level: "fresh", inactiveDays: 0 });
    // A clock running behind never produces decay.
    expect(gardenVitality("2026-11-10", "2026-11-09", config).inactiveDays).toBe(0);
  });
});

describe("weather", () => {
  it("shows the streak as sunny days only while it is alive", () => {
    expect(sunnyDays({ days: 4, lastActiveDay: "2026-11-04" }, "2026-11-04")).toBe(4);
    expect(sunnyDays({ days: 4, lastActiveDay: "2026-11-03" }, "2026-11-04")).toBe(4);
    expect(sunnyDays({ days: 4, lastActiveDay: "2026-11-02" }, "2026-11-04")).toBe(0);
    expect(sunnyDays({ days: 0, lastActiveDay: null }, "2026-11-04")).toBe(0);
  });

  it("maps vitality to the sky", () => {
    expect(skyFor("fresh")).toBe("sun");
    expect(skyFor("thirsty")).toBe("clouds");
    expect(skyFor("wilted")).toBe("clouds");
    expect(skyFor("dormant")).toBe("grey");
  });
});

describe("beds", () => {
  const beds = (runs: GardenRun[], extra: { niveauEEnabled?: boolean; ePathSuggested?: boolean } = {}) =>
    gardenBeds({ missions, runs, config, niveauEEnabled: false, ePathSuggested: false, ...extra });

  it("starts with an open first bed and closed beds behind it", () => {
    const b = beds([]);
    expect(b.map((x) => x.stufe)).toEqual([1, 2, 3, 4, 5, "boss"]);
    expect(b.map((x) => x.state)).toEqual(["open", "locked", "locked", "locked", "locked", "locked"]);
    expect(b[0]!.plots.map((p) => p.missionId)).toEqual(["m-01-01", "m-01-02"]);
    expect(b[0]!.plots.every((p) => p.plant === null)).toBe(true);
    expect(b[0]!.variety).toBe("Gänseblümchen");
  });

  it("fills a bed after two completed missions and opens the next", () => {
    const b = beds([done("m-01-01"), done("m-01-02")]);
    expect(b[0]!.state).toBe("full");
    expect(b[1]!.state).toBe("open");
    expect(b[2]!.state).toBe("locked");
  });

  it("opens the boss bed after the M path and fills it with the tree", () => {
    const path = M_PATH.map((id) => done(id));
    expect(beds(path).at(-1)!.state).toBe("open");
    const b = beds([...path, done("boss-01")]);
    expect(b.at(-1)).toMatchObject({ stufe: "boss", state: "full", variety: "Apfelbaum" });
  });

  it("hides stage 6 on M, shows a closed teaser while E is only suggested, and opens it when an adult enabled E", () => {
    const path = M_PATH.map((id) => done(id));
    expect(beds(path).map((x) => x.stufe)).not.toContain(6);
    const teaser = beds(path, { ePathSuggested: true });
    expect(teaser.find((x) => x.stufe === 6)).toMatchObject({ state: "teaser", plots: [] });
    expect(teaser.at(-1)!.state).toBe("open");
    const e = beds(path, { niveauEEnabled: true });
    expect(e.find((x) => x.stufe === 6)!.state).toBe("open");
    // SW-03: with E enabled after stage 5, stage 6 comes before the boss.
    expect(e.at(-1)!.state).toBe("locked");
  });

  it("shows the most advanced run of a mission and counts its blooms", () => {
    const b = beds([done("m-01-01", "r1"), open("m-01-01", "r2"), done("m-01-01", "r3")]);
    const plant = b[0]!.plots[0]!.plant!;
    expect(plant).toMatchObject({ stage: "bloom", blooms: 2, runId: "r3", stageLabel: "Blüte" });
    // The colour comes from the first completed run, so a restart does not repaint the flower.
    expect(plant.color).toEqual(bloomColor("r1", varietyFor(1, config)));
  });

  it("keeps the bloom colour secret until the plant blooms", () => {
    const plant = beds([open("m-01-01")])[0]!.plots[0]!.plant!;
    expect(plant).toMatchObject({ stage: "seed", color: null, blooms: 0 });
  });

  it("picks the mystery colour deterministically per run", () => {
    const variety = varietyFor(4, config);
    expect(bloomColor("run-a", variety)).toEqual(bloomColor("run-a", variety));
    const seen = new Set(Array.from({ length: 40 }, (_, i) => bloomColor(`run-${i}`, variety).id));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("garden house", () => {
  it("builds part by part along the M path and needs stage 6 only for the weather vane", () => {
    expect(builtHouseParts(missions, [])).toEqual([]);
    expect(builtHouseParts(missions, [done("m-01-01")])).toEqual(["foundation"]);
    expect(builtHouseParts(missions, [done("m-01-01"), done("m-01-02")])).toEqual(["foundation", "walls"]);
    const mPath = [...M_PATH.map((id) => done(id)), done("boss-01")];
    expect(builtHouseParts(missions, mPath)).toEqual(["foundation", "walls", "door", "windows", "roof", "greenhouse", "chimney"]);
    expect(builtHouseParts(missions, [...mPath, done("m-06-01"), done("m-06-02")])).toContain("weather_vane");
  });

  it("hangs only badges counted by code on the house", () => {
    expect(houseBadges(["planer", "verknuepfer", "durchhalter", "beispiel_jaeger"])).toEqual(["planer", "durchhalter"]);
  });
});

describe("visitors", () => {
  const visitors = (extra: Partial<Parameters<typeof gardenVisitors>[0]>) =>
    gardenVisitors({ missions, runs: [], passedStationIds: [], badges: [], ...extra });

  it("arrive on milestones", () => {
    expect(visitors({})).toEqual([]);
    expect(visitors({ runs: [done("m-01-01")] })).toEqual(["butterfly"]);
    expect(visitors({ runs: M_PATH.slice(0, 5).map((id) => done(id)) })).toEqual(["butterfly", "bee"]);
    expect(visitors({ passedStationIds: ["st-01-01", "st-01-02", "st-02-01", "st-02-02", "st-03-01"] })).toEqual(["squirrel"]);
    expect(visitors({ badges: ["durchhalter"] })).toEqual(["hedgehog"]);
    expect(visitors({ runs: [done("m-01-01", "a"), done("m-01-01", "b")] })).toContain("blackbird");
    expect(visitors({ runs: [done("boss-01")] })).toContain("owl");
  });
});

describe("garden view", () => {
  it("welcomes an empty garden", () => {
    const view = gardenView(input());
    expect(view.vitality).toMatchObject({ level: "fresh", message: config.messages.empty });
    expect(view.totals).toEqual({ plants: 0, blooms: 0 });
    expect(view.house.parts.every((p) => !p.built)).toBe(true);
  });

  it("names the vitality and the holidays", () => {
    const runs = [done("m-01-01")];
    expect(gardenView(input({ runs, lastActiveDay: "2026-11-02", today: "2026-11-04" })).vitality).toMatchObject({
      level: "thirsty",
      message: config.messages.thirsty,
    });
    expect(gardenView(input({ runs, lastActiveDay: "2026-11-02", today: "2026-11-12" })).weather.sky).toBe("grey");
    expect(gardenView(input({ runs, lastActiveDay: "2026-10-23", today: "2026-10-28" })).vitality.message).toBe(
      config.messages.ferien,
    );
  });

  it("keeps everything earned while the garden is dormant", () => {
    const base = { runs: [done("m-01-01"), done("m-01-02"), open("m-02-01")], badges: ["durchhalter" as const] };
    const fresh = gardenView(input({ ...base, lastActiveDay: "2026-11-04", today: "2026-11-04" }));
    const dormant = gardenView(input({ ...base, lastActiveDay: "2026-11-04", today: "2027-03-01" }));
    expect(dormant.vitality.level).toBe("dormant");
    expect(dormant.beds).toEqual(fresh.beds);
    expect(dormant.house).toEqual(fresh.house);
    expect(dormant.visitors).toEqual(fresh.visitors);
    expect(dormant.totals).toEqual(fresh.totals);
  });

  it("counts available help cards in the tool shed", () => {
    expect(gardenView(input({ availableHelpCardIds: ["HK-02", "HK-03", "HK-02"] })).house.toolShedCards).toBe(2);
  });
});

describe("the garden never reads AI output (SW-31)", () => {
  function completedWith(scores: { aufbau: 0 | 3; argumentation: 0 | 3; sprache: 0 | 3; richtigkeit: 0 | 3 }, fulfilled: boolean) {
    const result = replay(createRun({ missionId: "m-04-01", stufe: 4, niveauEEnabled: false }), [
      ...PAPER_PLAN,
      ...PAPER_TEXT,
      { type: "SELF_CHECK_SUBMITTED", selfCheck },
      { type: "TEXT_REVIEWED", review: makeTextReview({ scores }) },
      { type: "START_REVISION" },
      { type: "REVISION_SUBMITTED", text: "Erster Versuch." },
      { type: "REVISION_CHECKED", check: { fulfilled, feedback: "Danke." } },
      ...(fulfilled
        ? []
        : ([
            { type: "REVISION_SUBMITTED", text: "Zweiter Versuch." },
            { type: "REVISION_CHECKED", check: { fulfilled, feedback: "Danke." } },
          ] as MissionEvent[])),
    ]);
    if (!result.ok) throw new Error(result.error.reason);
    return result.run;
  }

  it("shows the same garden for zero stars and full stars, fulfilled or not", () => {
    const low = completedWith({ aufbau: 0, argumentation: 0, sprache: 0, richtigkeit: 0 }, false);
    const high = completedWith({ aufbau: 3, argumentation: 3, sprache: 3, richtigkeit: 3 }, true);
    expect(low.state).toBe("completed");
    expect(high.state).toBe("completed");
    const view = (run: MissionRun) => gardenView(input({ runs: [{ runId: "r", run }], lastActiveDay: "2026-11-04" }));
    expect(view(low)).toEqual(view(high));
  });

  it("has no reference to feedback, scores or revision checks in its source", () => {
    const source = readFileSync(new URL("domain/garden.ts", MODULE_ROOT), "utf8");
    expect(source).not.toMatch(/\.feedback\b|\.scores\b|e_bonus|\.review\b|\.checks\b|fulfilled|computeStars|StarSummary/);
  });
});

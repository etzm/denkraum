// Garden layer: the progress map as a garden (docs/spielschicht.md, SW-29 to SW-36).
// Pure functions only.
//
// - Everything is derived from code-checked facts: mission runs, passed stations,
//   streak and activity days. The garden never reads stars or any other AI output
//   (SW-31), so it shows effort and completion, not an assessment.
// - Nothing earned ever goes back. Plant stages only move forward, house parts and
//   visitors stay. Only the derived vitality changes, and one activity restores it (SW-30).

import type { Stufe } from "../schemas/common.ts";
import type { Mission } from "../schemas/content.ts";
import type { GardenConfig, HousePart, PlantStage, Visitor, Vitality } from "../schemas/garden.ts";
import { HOUSE_PARTS, PLANT_STAGES, VISITORS } from "../schemas/garden.ts";
import { seededRandom } from "./exercises.ts";
import type { BadgeId, Streak } from "./rules.ts";
import { addDays, BADGES, currentStufe, isStageCompleted, minWordsFor, stagePath, stageRank } from "./rules.ts";
import type { MissionRun } from "./state.ts";
import { stageMedia } from "./state.ts";

// ---------------------------------------------------------------------------
// Plant: one per mission run

/**
 * Growth follows the mission flow. Every step reads a field that the state machine
 * only ever sets forward, so a plant never shrinks (a too short text or a hold for
 * an adult keeps the current stage).
 */
export function plantStage(run: MissionRun): PlantStage {
  if (run.state === "completed") return "bloom";
  if (run.selfCheck !== null) return "bud";
  const confirmed = run.text.confirmed !== null;
  if (confirmed && (run.text.wordCount ?? 0) >= minWordsFor(run.stufe)) return "leaves";
  if (stageMedia(run.stufe).plan === "none") {
    // Stages 1 and 5 have no plan: the first submitted text lets the seed sprout.
    if (confirmed) return "sprout";
  } else if (run.plan.approvedInRound !== null || run.notes.includes("plan_approved_after_max_rounds")) {
    return "sprout";
  }
  return run.state === "briefing" ? "seed" : "sown";
}

export function plantRank(stage: PlantStage): number {
  return PLANT_STAGES.indexOf(stage);
}

type Variety = GardenConfig["varieties"]["1"];
type BloomColor = Variety["colors"][number];

export function varietyFor(stufe: Stufe, config: GardenConfig): Variety {
  return config.varieties[String(stufe) as keyof GardenConfig["varieties"]];
}

/** The mystery seed: a deterministic colour per run, cosmetic only (SW-32). */
export function bloomColor(runId: string, variety: Variety): BloomColor {
  return variety.colors[Math.floor(seededRandom(runId)() * variety.colors.length)]!;
}

// ---------------------------------------------------------------------------
// Vitality: wilts, never dies (SW-30)

/** True when the day lies in a configured school holiday. */
export function isFerien(day: string, config: GardenConfig): boolean {
  return config.ferien.some((f) => f.from <= day && day <= f.to);
}

function isWeekend(day: string): boolean {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6;
}

/** A day that counts as inactive when nothing happened: not in the holidays and, by default, not on a weekend. */
export function isCountingDay(day: string, config: GardenConfig): boolean {
  if (isFerien(day, config)) return false;
  return config.vitality.countWeekends || !isWeekend(day);
}

/** Upper bound for the day loop; far beyond any real gap between two activities. */
const MAX_SCAN_DAYS = 1000;

/**
 * Counting days after the last active day up to and including today. Stops at the
 * dormant threshold because the garden never gets worse than dormant.
 */
export function inactiveDays(lastActiveDay: string, today: string, config: GardenConfig): number {
  let count = 0;
  let day = lastActiveDay;
  for (let i = 0; i < MAX_SCAN_DAYS && day < today && count < config.vitality.dormantAfter; i++) {
    day = addDays(day, 1);
    if (isCountingDay(day, config)) count++;
  }
  return count;
}

export function vitalityLevel(days: number, config: GardenConfig): Vitality {
  const v = config.vitality;
  if (days >= v.dormantAfter) return "dormant";
  if (days >= v.wiltedAfter) return "wilted";
  if (days >= v.thirstyAfter) return "thirsty";
  return "fresh";
}

export type VitalityView = { level: Vitality; inactiveDays: number; ferien: boolean };

/**
 * Activity is any finished station round or any mission step (the platform passes
 * the latest day). Before the first activity the garden is fresh and empty.
 */
export function gardenVitality(lastActiveDay: string | null, today: string, config: GardenConfig): VitalityView {
  const ferien = isFerien(today, config);
  if (lastActiveDay === null) return { level: "fresh", inactiveDays: 0, ferien };
  const days = inactiveDays(lastActiveDay, today, config);
  return { level: vitalityLevel(days, config), inactiveDays: days, ferien };
}

// ---------------------------------------------------------------------------
// Weather: the habit signal

export type Sky = "sun" | "clouds" | "grey";

/** The streak counts while the last streak day is today or yesterday (SW-17); otherwise no sunny days are shown. */
export function sunnyDays(streak: Streak, today: string): number {
  const last = streak.lastActiveDay;
  if (last === null) return 0;
  return last === today || addDays(last, 1) === today ? streak.days : 0;
}

export function skyFor(level: Vitality): Sky {
  if (level === "fresh") return "sun";
  if (level === "dormant") return "grey";
  return "clouds";
}

// ---------------------------------------------------------------------------
// Beds, house, visitors

/** A run with its stored id. Runs are passed in start order. */
export type GardenRun = { runId: string; run: MissionRun };

export type BedState = "locked" | "open" | "full" | "teaser";

export type PlantView = {
  runId: string;
  stage: PlantStage;
  stageLabel: string;
  variety: string;
  /** Revealed once the mission blooms; taken from the first completed run so a restart keeps it. */
  color: BloomColor | null;
  /** Completed runs of this mission; a restart that completes adds a bloom. */
  blooms: number;
};

export type PlotView = { missionId: string; title: string; plant: PlantView | null };

export type BedView = { stufe: Stufe; variety: string; state: BedState; plots: PlotView[] };

function completedMissionIds(runs: readonly GardenRun[]): string[] {
  return [...new Set(runs.filter((r) => r.run.state === "completed").map((r) => r.run.missionId))];
}

function plotFor(mission: Mission, runs: readonly GardenRun[], config: GardenConfig): PlotView {
  const own = runs.filter((r) => r.run.missionId === mission.id);
  const variety = varietyFor(mission.stufe, config);
  let best: GardenRun | null = null;
  for (const r of own) {
    // Ties go to the later run, so the plot shows the newest attempt at the same height.
    if (!best || plantRank(plantStage(r.run)) >= plantRank(plantStage(best.run))) best = r;
  }
  if (!best) return { missionId: mission.id, title: mission.title, plant: null };
  const completed = own.filter((r) => r.run.state === "completed");
  const stage = plantStage(best.run);
  return {
    missionId: mission.id,
    title: mission.title,
    plant: {
      runId: best.runId,
      stage,
      stageLabel: config.labels.plantStages[stage],
      variety: variety.name,
      color: completed[0] ? bloomColor(completed[0].runId, variety) : null,
      blooms: completed.length,
    },
  };
}

/**
 * One bed per stage on the student's path. Stage 6 appears when Niveau E is on (or a
 * stage 6 run exists); while the system suggests E and no adult decided yet, it shows
 * as a closed teaser bed without plots (SW-33).
 */
export function gardenBeds(input: {
  missions: readonly Mission[];
  runs: readonly GardenRun[];
  niveauEEnabled: boolean;
  ePathSuggested: boolean;
  config: GardenConfig;
}): BedView[] {
  const { missions, runs, config } = input;
  const completed = completedMissionIds(runs);
  const hasStage6Run = runs.some((r) => r.run.stufe === 6);
  const showStage6 = input.niveauEEnabled || hasStage6Run;
  const current = currentStufe(missions, {
    niveauEEnabled: showStage6,
    completedMissionIds: completed,
    passedStationIds: [],
  });
  const stages: Stufe[] = stagePath(showStage6);
  if (!showStage6 && input.ePathSuggested) stages.splice(stages.indexOf("boss"), 0, 6);

  return stages.map((stufe): BedView => {
    const variety = varietyFor(stufe, config).name;
    if (stufe === 6 && !showStage6) return { stufe, variety, state: "teaser", plots: [] };
    const plots = missions
      .filter((m) => m.stufe === stufe)
      .sort((a, b) => a.order - b.order)
      .map((m) => plotFor(m, runs, config));
    let state: BedState;
    if (stufe === "boss") {
      const bossDone = missions.some((m) => m.bossMode && completed.includes(m.id));
      state = bossDone ? "full" : current === "boss" ? "open" : "locked";
    } else if (isStageCompleted(stufe, missions, completed)) {
      state = "full";
    } else {
      state = stageRank(stufe) <= stageRank(current) ? "open" : "locked";
    }
    return { stufe, variety, state, plots };
  });
}

/**
 * The garden house grows with completed stages. The M path builds it up to the
 * chimney (boss); the weather vane is the extra for stage 6.
 */
export function builtHouseParts(missions: readonly Mission[], runs: readonly GardenRun[]): HousePart[] {
  const completed = completedMissionIds(runs);
  const stageDone = (stufe: Stufe) => isStageCompleted(stufe, missions, completed);
  const built: Record<HousePart, boolean> = {
    foundation: completed.length > 0,
    walls: stageDone(1),
    door: stageDone(2),
    windows: stageDone(3),
    roof: stageDone(4),
    greenhouse: stageDone(5),
    chimney: missions.some((m) => m.bossMode && completed.includes(m.id)),
    weather_vane: stageDone(6),
  };
  return HOUSE_PARTS.filter((p) => built[p]);
}

/** Badges hung on the house: only those counted by code, none from AI judgments (SW-31). */
export function houseBadges(badges: readonly BadgeId[]): BadgeId[] {
  return badges.filter((id) => BADGES[id].source === "code");
}

/** Visitors appear on milestones. The rules are not shown to the child; they are a small surprise. */
export function gardenVisitors(input: {
  missions: readonly Mission[];
  runs: readonly GardenRun[];
  passedStationIds: readonly string[];
  badges: readonly BadgeId[];
}): Visitor[] {
  const completedRuns = input.runs.filter((r) => r.run.state === "completed");
  const bloomsPerMission = new Map<string, number>();
  for (const r of completedRuns) bloomsPerMission.set(r.run.missionId, (bloomsPerMission.get(r.run.missionId) ?? 0) + 1);
  const completed = [...bloomsPerMission.keys()];
  const present: Record<Visitor, boolean> = {
    butterfly: completedRuns.length >= 1,
    bee: completedRuns.length >= 5,
    squirrel: new Set(input.passedStationIds).size >= 5,
    hedgehog: input.badges.includes("durchhalter"),
    blackbird: [...bloomsPerMission.values()].some((n) => n >= 2),
    owl: input.missions.some((m) => m.bossMode && completed.includes(m.id)),
  };
  return VISITORS.filter((v) => present[v]);
}

// ---------------------------------------------------------------------------
// The whole garden as one view model for the UI

export type GardenInput = {
  /** Berlin calendar day, from `berlinDay(now)`. */
  today: string;
  missions: readonly Mission[];
  runs: readonly GardenRun[];
  niveauEEnabled: boolean;
  ePathSuggested: boolean;
  passedStationIds: readonly string[];
  streak: Streak;
  /** Latest Berlin day with a finished station round or a mission step. */
  lastActiveDay: string | null;
  badges: readonly BadgeId[];
  /** Help cards the student can use now; they fill the tool shed. */
  availableHelpCardIds: readonly string[];
  config: GardenConfig;
};

export type GardenView = {
  vitality: VitalityView & { message: string };
  weather: { sky: Sky; sunnyDays: number };
  beds: BedView[];
  house: { parts: { id: HousePart; label: string; built: boolean }[]; badges: BadgeId[]; toolShedCards: number };
  visitors: { id: Visitor; label: string }[];
  totals: { plants: number; blooms: number };
};

export function gardenView(input: GardenInput): GardenView {
  const { config } = input;
  const vitality = gardenVitality(input.lastActiveDay, input.today, config);
  const empty = input.runs.length === 0 && input.lastActiveDay === null;
  const message = empty
    ? config.messages.empty
    : vitality.ferien
      ? config.messages.ferien
      : config.messages[vitality.level];
  const built = builtHouseParts(input.missions, input.runs);
  const beds = gardenBeds(input);
  return {
    vitality: { ...vitality, message },
    weather: { sky: skyFor(vitality.level), sunnyDays: sunnyDays(input.streak, input.today) },
    beds,
    house: {
      parts: HOUSE_PARTS.map((id) => ({ id, label: config.labels.houseParts[id], built: built.includes(id) })),
      badges: houseBadges(input.badges),
      toolShedCards: new Set(input.availableHelpCardIds).size,
    },
    visitors: gardenVisitors(input).map((id) => ({ id, label: config.labels.visitors[id] })),
    totals: {
      plants: beds.flatMap((b) => b.plots).filter((p) => p.plant !== null).length,
      blooms: input.runs.filter((r) => r.run.state === "completed").length,
    },
  };
}

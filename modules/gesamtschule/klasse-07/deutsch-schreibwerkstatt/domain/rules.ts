// Game and unlock rules of the Schreibwerkstatt (spec 3.2 to 3.4, adapted per
// umsetzungsplan 5.3 and DECISIONS.md of this module). Pure functions only.
//
// Core principle (D-006, SW-01): code decides, the model only formulates.
// AI stars are formative. No function in this file that gates progress
// (completion, stage, boss, missions, help cards, joker) reads stars.

import type { Star, Stufe } from "../schemas/common.ts";
import type { HelpCard, Mission } from "../schemas/content.ts";
import type { PlanTranscript } from "../schemas/planTranscript.ts";
import type { TextReview } from "../schemas/textReview.ts";
import { editDistanceRatio, isFilled } from "./text.ts";

// ---------------------------------------------------------------------------
// Stages

/** Completed missions of a stage needed to advance (spec 3.2, "Nächste Stufe"). */
export const MISSIONS_TO_ADVANCE = 2;

/** Numeric position on the ladder; the boss comes after stage 6. */
export function stageRank(stufe: Stufe): number {
  return stufe === "boss" ? 7 : stufe;
}

/** The path a student walks. Stage 6 only when an adult enabled Niveau E. */
export function stagePath(niveauEEnabled: boolean): Stufe[] {
  return niveauEEnabled ? [1, 2, 3, 4, 5, 6, "boss"] : [1, 2, 3, 4, 5, "boss"];
}

/** Stage 6 is visible only when Niveau E is enabled (spec 2.4). */
export function isStageVisible(stufe: Stufe, niveauEEnabled: boolean): boolean {
  return stufe !== 6 || niveauEEnabled;
}

/** Facts about a student that the unlock rules read. No stars in here on purpose. */
export type ProgressContext = {
  /** Set only by a human (adult flag), never by the system (SW-05). */
  niveauEEnabled: boolean;
  completedMissionIds: readonly string[];
  passedStationIds: readonly string[];
};

export function completedMissionsInStage(
  stufe: Stufe,
  missions: readonly Mission[],
  completedMissionIds: readonly string[],
): number {
  return missions.filter((m) => m.stufe === stufe && completedMissionIds.includes(m.id)).length;
}

export function isStageCompleted(
  stufe: Stufe,
  missions: readonly Mission[],
  completedMissionIds: readonly string[],
): boolean {
  return completedMissionsInStage(stufe, missions, completedMissionIds) >= MISSIONS_TO_ADVANCE;
}

/** The first stage on the path that is not completed yet, or "boss". */
export function currentStufe(missions: readonly Mission[], ctx: ProgressContext): Stufe {
  for (const stufe of stagePath(ctx.niveauEEnabled)) {
    if (stufe === "boss" || !isStageCompleted(stufe, missions, ctx.completedMissionIds)) return stufe;
  }
  return "boss";
}

/** Boss startable after stage 5 (M) or stage 6 (E) is completed (spec 3.2). */
export function isBossStartable(missions: readonly Mission[], ctx: ProgressContext): boolean {
  return currentStufe(missions, ctx) === "boss";
}

/**
 * Content approval (D-022, SW-26): unapproved missions are shown only when the operator sets
 * DENKRAUM_SHOW_UNAPPROVED=true (tests, review of drafts). Otherwise they wait for approval.
 */
export function isMissionShown(mission: Pick<Mission, "approved">, showUnapproved: boolean): boolean {
  return mission.approved || showUnapproved;
}

export type StartBlocker =
  | "not_approved"
  | "niveau_e_required"
  | "stage_locked"
  | "station_not_passed"
  | "previous_mission_open";

/**
 * Mission startable (spec 3.2): the station before it is passed and the previous
 * mission of the stage is completed. Also: content approved by the teacher, stage
 * reached, Niveau E for stage 6. Restarting a completed mission is allowed (spec 3.4).
 */
export function checkMissionStart(
  mission: Mission,
  missions: readonly Mission[],
  ctx: ProgressContext,
): { startable: boolean; blockers: StartBlocker[] } {
  const blockers: StartBlocker[] = [];
  if (!mission.approved) blockers.push("not_approved");
  if ((mission.niveau === "E" || mission.stufe === 6) && !ctx.niveauEEnabled) blockers.push("niveau_e_required");
  if (stageRank(mission.stufe) > stageRank(currentStufe(missions, ctx))) blockers.push("stage_locked");
  const station = mission.requiresExerciseStationId;
  if (station !== null && !ctx.passedStationIds.includes(station)) blockers.push("station_not_passed");
  const previous = missions.find((m) => m.stufe === mission.stufe && m.order === mission.order - 1);
  if (previous && !ctx.completedMissionIds.includes(previous.id)) blockers.push("previous_mission_open");
  return { startable: blockers.length === 0, blockers };
}

// ---------------------------------------------------------------------------
// Mission completed (replaces "bestanden" as the gate, SW-02)

/** Below this a full text is not reviewed (spec 7.1, `too_short`). */
export const MIN_WORDS_FULL_TEXT = 80;

/** Stages 1 and 2 write sentences or one paragraph; from stage 3 on (and in the boss) a full text. */
export function isFullTextStage(stufe: Stufe): boolean {
  return stufe !== 1 && stufe !== 2;
}

/** Minimum length of the confirmed text: 80 words for full texts, otherwise just not empty. */
export function minWordsFor(stufe: Stufe): number {
  return isFullTextStage(stufe) ? MIN_WORDS_FULL_TEXT : 1;
}

export type CompletionFacts = {
  /** Upload transcript confirmed by the student, or text typed. */
  textConfirmed: boolean;
  /** Counted by code on the confirmed text. */
  wordCount: number;
  minWords: number;
  selfCheckSubmitted: boolean;
  revisionAttempts: number;
  /** Result of the latest revision check; null while none arrived. */
  revisionFulfilled: boolean | null;
  /** The latest attempt could not be checked because the model gave no result (SW-29). */
  revisionUnchecked?: boolean;
};

/**
 * Revision is done when it was fulfilled or a second attempt was made (spec 4). An attempt the
 * model could not check also counts: completion never waits for the model (SW-29).
 */
export function isRevisionDone(attempts: number, fulfilled: boolean | null, unchecked = false): boolean {
  return attempts >= 2 || (attempts >= 1 && (fulfilled === true || unchecked));
}

/** Mission completed: only code-checkable facts, never stars (SW-02). */
export function isMissionCompleted(f: CompletionFacts): boolean {
  return (
    f.textConfirmed &&
    f.wordCount >= f.minWords &&
    f.selfCheckSubmitted &&
    isRevisionDone(f.revisionAttempts, f.revisionFulfilled, f.revisionUnchecked ?? false)
  );
}

// ---------------------------------------------------------------------------
// Plan gate (SW-04): code checks the confirmed plan, the model's `approved` is advisory

export type PlanTemplate = "planning_sheet" | "paragraph_template";
export type PlanGap = "standpunkt" | "zwei_argumente_mit_begruendung" | "argument_mit_begruendung";

/** Student-facing hints for plan_revise. */
export const PLAN_GAP_HINTS: Record<PlanGap, string> = {
  standpunkt: "Schreib deinen Standpunkt in den Kasten MEIN STANDPUNKT.",
  zwei_argumente_mit_begruendung: "Du brauchst mindestens zwei Argumente, jedes mit Behauptung und Begründung.",
  argument_mit_begruendung: "Dein Argument braucht eine Behauptung und eine Begründung.",
};

/** Revision rounds after the first plan; afterwards the plan is approved with a note (spec 4). */
export const MAX_PLAN_REVISIONS = 2;

export function countArgumentsWithReason(plan: PlanTranscript): number {
  return plan.argumente.filter((a) => isFilled(a.behauptung) && isFilled(a.begruendung)).length;
}

/** Spec 7.2: stance not missing and at least two arguments with a reason. Paragraph template: one argument. */
export function planGate(plan: PlanTranscript, template: PlanTemplate): { approved: boolean; missing: PlanGap[] } {
  const missing: PlanGap[] = [];
  const withReason = countArgumentsWithReason(plan);
  if (template === "paragraph_template") {
    if (withReason < 1) missing.push("argument_mit_begruendung");
  } else {
    if (!isFilled(plan.standpunkt)) missing.push("standpunkt");
    if (withReason < 2) missing.push("zwei_argumente_mit_begruendung");
  }
  return { approved: missing.length === 0, missing };
}

// ---------------------------------------------------------------------------
// Transcription checks (spec 3.4, 6.3)

/** Above this share of changed characters the confirmation is flagged (spec 3.4). */
export const EDIT_DISTANCE_FLAG = 0.25;

export type EditCheck = { ratio: number; flagged: boolean };

/** v1: flag only, the mission is not reset (umsetzungsplan 7.3, SW-08). */
export function editDistanceCheck(raw: string, confirmed: string): EditCheck {
  const ratio = editDistanceRatio(raw, confirmed);
  return { ratio, flagged: ratio > EDIT_DISTANCE_FLAG };
}

/** Below this legibility the UI asks for a new photo before confirming (spec 6.3). */
export const RETAKE_LEGIBILITY = 0.5;

export function suggestRetake(legibility: number): boolean {
  return legibility < RETAKE_LEGIBILITY;
}

// ---------------------------------------------------------------------------
// Stars: formative display only (SW-01)

export type Scores = { aufbau: Star; argumentation: Star; sprache: Star; richtigkeit: Star };

/**
 * Seam for dimension D (SW-06). The AI-facing code does not decide D. The caller
 * passes an error count: in v1 the review's `error_density` (interim), later a
 * self-hosted LanguageTool count on the confirmed transcript.
 */
export type ErrorDensityInput = {
  errorsPer100Words: number;
  source: "ai_review" | "languagetool";
};

/** Rubric D (spec 7.1): 0 to 1 errors per 100 words 3 stars, up to 4: 2, up to 8: 1, more: 0. */
export function richtigkeitStars(errorsPer100Words: number): Star {
  if (errorsPer100Words <= 1) return 3;
  if (errorsPer100Words <= 4) return 2;
  if (errorsPer100Words <= 8) return 1;
  return 0;
}

/** Spec 6.6: a typed fallback shows at most 10 stars on stages 4 and 6. */
export const TYPED_FALLBACK_STAR_CAP = 10;

export type StarSummary = {
  scores: Scores;
  /** Sum of the four dimensions, 0 to 12. */
  base: number;
  /** E bonus stars, 0 to 3; only when Niveau E is enabled. */
  bonus: number;
  /** What the student sees as total of the four dimensions. */
  display: number;
  capped: boolean;
};

export function computeStars(input: {
  ai: Pick<TextReview, "scores" | "e_bonus">;
  richtigkeit: ErrorDensityInput;
  niveauEEnabled: boolean;
  stufe: Stufe;
  /** The text was typed where paper was expected. */
  typedFallback: boolean;
}): StarSummary {
  const scores: Scores = {
    aufbau: input.ai.scores.aufbau,
    argumentation: input.ai.scores.argumentation,
    sprache: input.ai.scores.sprache,
    richtigkeit: richtigkeitStars(input.richtigkeit.errorsPer100Words),
  };
  const base = sumScores(scores);
  const eb = input.ai.e_bonus;
  const bonus =
    input.niveauEEnabled && eb
      ? [eb.gegenargument_genannt, eb.gegenargument_entkraeftet, eb.schlussregel].filter(Boolean).length
      : 0;
  const capApplies = input.typedFallback && (input.stufe === 4 || input.stufe === 6);
  const display = capApplies ? Math.min(base, TYPED_FALLBACK_STAR_CAP) : base;
  return { scores, base, bonus, display, capped: display < base };
}

export function sumScores(s: Scores): number {
  return s.aufbau + s.argumentation + s.sprache + s.richtigkeit;
}

/** What the student sees after P4 (D-020: for the child only, gates nothing). */
export type FormativeStars = {
  aufbau: Star;
  argumentation: Star;
  sprache: Star;
  /** Null while no rule based count exists (D-021: no spelling stars for typed text in B1). Shown as "kommt später". */
  richtigkeit: Star | null;
  /** Sum of the dimensions that are shown. */
  shown: number;
  /** 9 without dimension D, 12 with it. */
  max: number;
  capped: boolean;
};

/**
 * Formative stars for display. Dimension D comes only from `richtigkeit` (SW-06); the model's own
 * D stars are ignored. Without an error count, D is left out instead of guessed.
 */
export function formativeStars(input: {
  ai: Pick<TextReview, "scores">;
  richtigkeit: ErrorDensityInput | null;
  stufe: Stufe;
  typedFallback: boolean;
}): FormativeStars {
  const { aufbau, argumentation, sprache } = input.ai.scores;
  const richtigkeit = input.richtigkeit ? richtigkeitStars(input.richtigkeit.errorsPer100Words) : null;
  const sum = aufbau + argumentation + sprache + (richtigkeit ?? 0);
  // Spec 6.6 caps a typed fallback at 10 of 12; without D the maximum is 9, so the cap cannot bite.
  const capApplies = richtigkeit !== null && input.typedFallback && (input.stufe === 4 || input.stufe === 6);
  const shown = capApplies ? Math.min(sum, TYPED_FALLBACK_STAR_CAP) : sum;
  return { aufbau, argumentation, sprache, richtigkeit, shown, max: richtigkeit === null ? 9 : 12, capped: shown < sum };
}

/** Restart or joker: the better of two passes counts, never the sum (spec 3.4). Ties keep the first. */
export function betterStars(first: StarSummary, second: StarSummary): StarSummary {
  return second.display + second.bonus > first.display + first.bonus ? second : first;
}

// ---------------------------------------------------------------------------
// Niveau E: the system only suggests, an adult decides (SW-05)

/** Spec 2.4: two stage 4 missions in a row with at least 10 of 12 stars and no dimension below 2. */
export function isEPathSuggested(stage4ScoresInOrder: readonly Scores[]): boolean {
  const qualifies = (s: Scores) =>
    sumScores(s) >= 10 && Math.min(s.aufbau, s.argumentation, s.sprache, s.richtigkeit) >= 2;
  for (let i = 1; i < stage4ScoresInOrder.length; i++) {
    if (qualifies(stage4ScoresInOrder[i - 1]!) && qualifies(stage4ScoresInOrder[i]!)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Keys, joker, help cards (spec 3.2)

export const KEYS_PER_STATION = 1;
export const JOKER_COST = 2;
export const MAX_JOKERS_PER_MISSION = 1;

export function canUseJoker(input: { keys: number; jokerUsed: boolean }): boolean {
  return input.keys >= JOKER_COST && !input.jokerUsed;
}

/** A card costs its price while its stage is current or ahead; after the student advanced past it, it is free. */
export function helpCardCost(card: Pick<HelpCard, "stufe" | "cost">, current: Stufe): number {
  return stageRank(current) > card.stufe ? 0 : card.cost;
}

export type HelpCardContext = {
  currentStufe: Stufe;
  unlockedIds: readonly string[];
  niveauEEnabled: boolean;
};

export function isHelpCardAvailable(card: HelpCard, ctx: HelpCardContext): boolean {
  if (card.niveau === "E" && !ctx.niveauEEnabled) return false;
  return ctx.unlockedIds.includes(card.id) || helpCardCost(card, ctx.currentStufe) === 0;
}

export function unlockHelpCard(
  card: HelpCard,
  ctx: HelpCardContext & { keys: number },
):
  | { ok: true; keysLeft: number }
  | { ok: false; reason: "already_available" | "niveau_e_required" | "not_enough_keys" } {
  if (card.niveau === "E" && !ctx.niveauEEnabled) return { ok: false, reason: "niveau_e_required" };
  if (isHelpCardAvailable(card, ctx)) return { ok: false, reason: "already_available" };
  const cost = helpCardCost(card, ctx.currentStufe);
  if (ctx.keys < cost) return { ok: false, reason: "not_enough_keys" };
  return { ok: true, keysLeft: ctx.keys - cost };
}

/** Help cards shown during planning, writing and revision. None in the boss mission (spec 2.3). */
export function helpCardsForMission(mission: Mission, cards: readonly HelpCard[], ctx: HelpCardContext): HelpCard[] {
  if (mission.bossMode) return [];
  return cards.filter((c) => mission.helpCardIds.includes(c.id) && isHelpCardAvailable(c, ctx));
}

// ---------------------------------------------------------------------------
// XP and rewards: independent of AI judgments (SW-07)

export const XP = {
  missionCompleted: 100,
  stationPassed: 15,
  /** Once per mission run, at the first revision submission. */
  revisionSubmitted: 20,
  streakDay: 10,
} as const;

/** XP of one mission run: completion plus the revision, both checked by code (SW-07). Streak XP comes with the progress layer. */
export function missionXp(input: { completed: boolean; revisionsSubmitted: number }): number {
  if (!input.completed) return 0;
  return XP.missionCompleted + (input.revisionsSubmitted > 0 ? XP.revisionSubmitted : 0);
}

/** A key only for the first pass of a station (anti farming, spec 3.4); XP for every pass. */
export function stationRewards(input: { passed: boolean; firstPass: boolean }): { keys: number; xp: number } {
  if (!input.passed) return { keys: 0, xp: 0 };
  return { keys: input.firstPass ? KEYS_PER_STATION : 0, xp: XP.stationPassed };
}

// ---------------------------------------------------------------------------
// Streak by local calendar date in Europe/Berlin (spec 3.1, 3.5)

export const STREAK_TIME_ZONE = "Europe/Berlin";

const berlinFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: STREAK_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar date in Berlin as YYYY-MM-DD. */
export function berlinDay(at: Date): string {
  const parts = Object.fromEntries(berlinFormat.formatToParts(at).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Adds days to a YYYY-MM-DD date (calendar arithmetic, no time zone involved). */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

export type Streak = { days: number; lastActiveDay: string | null };

/**
 * Registers a finished station attempt or a completed mission (SW-17).
 * The first activity of a Berlin calendar day extends or restarts the streak and earns XP.
 */
export function registerActivity(streak: Streak, at: Date): { streak: Streak; newDay: boolean; xp: number } {
  const today = berlinDay(at);
  if (streak.lastActiveDay === today) return { streak, newDay: false, xp: 0 };
  const continues = streak.lastActiveDay !== null && addDays(streak.lastActiveDay, 1) === today;
  return {
    streak: { days: continues ? streak.days + 1 : 1, lastActiveDay: today },
    newDay: true,
    xp: XP.streakDay,
  };
}

// ---------------------------------------------------------------------------
// Boss timer (spec 3.4: runs on the server; the platform stores the start time)

export const BOSS_MINUTES = 45;

export function bossTimeLeftMs(startedAt: Date, now: Date): number {
  return Math.max(0, startedAt.getTime() + BOSS_MINUTES * 60_000 - now.getTime());
}

// ---------------------------------------------------------------------------
// Badges (spec 3.3). Rewards only, they gate nothing. Some read AI output (SW-18).

export const BADGE_IDS = [
  "planer",
  "behauptungs_profi",
  "beispiel_jaeger",
  "verknuepfer",
  "ueberarbeiter",
  "die_andere_seite",
  "durchhalter",
] as const;
export type BadgeId = (typeof BADGE_IDS)[number];

export const BADGES: Record<BadgeId, { title: string; rule: string; source: "code" | "ai_formative" }> = {
  planer: { title: "Planer", rule: "3 Pläne beim ersten Versuch freigegeben", source: "code" },
  behauptungs_profi: {
    title: "Behauptungs-Profi",
    rule: "10 Behauptungen mit Begründung in Mikroübungen oder Missionen",
    source: "code",
  },
  beispiel_jaeger: {
    title: "Beispiel-Jäger",
    rule: "3 Missionen, in denen jedes Argument ein Beispiel hat",
    source: "ai_formative",
  },
  verknuepfer: { title: "Verknüpfer", rule: "Sprache 3 Sterne in 2 Missionen", source: "ai_formative" },
  ueberarbeiter: { title: "Überarbeiter", rule: "5 Überarbeitungsaufgaben erledigt", source: "ai_formative" },
  die_andere_seite: {
    title: "Die andere Seite",
    rule: "Erste Mission mit entkräftetem Gegenargument",
    source: "ai_formative",
  },
  durchhalter: { title: "Durchhalter", rule: "7 Tage in Folge aktiv", source: "code" },
};

/** Counters the platform aggregates from stored runs and attempts. */
export type BadgeStats = {
  /** Plans that passed `planGate` in round 1. */
  plansApprovedFirstTry: number;
  /** `countArgumentsWithReason` over confirmed plans plus correct complete_bbb answers. */
  claimsWithReason: number;
  /** Missions whose verified Textlupe shows an example for every argument. */
  missionsWithExampleForEveryArgument: number;
  /** Missions with 3 stars in Sprache. */
  missionsWithSpracheThree: number;
  /** Revision checks with fulfilled = true. */
  revisionsFulfilled: number;
  /** Missions whose verified Textlupe shows a rebutted counterargument. */
  missionsWithRebuttal: number;
  streakDays: number;
};

export function earnedBadges(s: BadgeStats): BadgeId[] {
  const earned: Record<BadgeId, boolean> = {
    planer: s.plansApprovedFirstTry >= 3,
    behauptungs_profi: s.claimsWithReason >= 10,
    beispiel_jaeger: s.missionsWithExampleForEveryArgument >= 3,
    verknuepfer: s.missionsWithSpracheThree >= 2,
    ueberarbeiter: s.revisionsFulfilled >= 5,
    die_andere_seite: s.missionsWithRebuttal >= 1,
    durchhalter: s.streakDays >= 7,
  };
  return BADGE_IDS.filter((id) => earned[id]);
}

/** Lens helper for "Beispiel-Jäger": at least one argument, and every argument has an example. */
export function everyArgumentHasExample(lens: TextReview["lens"]): boolean {
  const args = lens.argumente.filter((a) => a.behauptung.trim() !== "");
  return args.length > 0 && args.every((a) => a.beispiel.trim() !== "");
}

// Micro exercises (spec 5): deterministic scoring, station result and a seeded
// pool draw. No model call at runtime.

import type { ExerciseStation } from "../schemas/content.ts";
import type { Exercise } from "../schemas/exercise.ts";

export const STATION_SIZE = 4;
export const STATION_PASS_THRESHOLD = 3;
/** An exercise reappears at the earliest after this many other exercises (spec 3.4). */
export const NO_REPEAT_WINDOW = 10;

function isIndexList(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((v) => Number.isInteger(v));
}

function sameSequence(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function sameSet(a: readonly number[], b: readonly number[]): boolean {
  const sa = new Set(a);
  return sa.size === a.length && sa.size === new Set(b).size && b.every((v) => sa.has(v));
}

/**
 * Scores one answer. The answer comes from the client and is untrusted:
 * anything with the wrong shape is simply wrong.
 *
 * Answer shapes: index (pick_thesis, sentence_upgrade), index per gap
 * (fill_connector), order of indices (sort_paragraphs, rank_arguments),
 * part name (complete_bbb), set of segment indices (mark_parts).
 */
export function scoreExercise(exercise: Exercise, answer: unknown): boolean {
  switch (exercise.type) {
    case "pick_thesis":
    case "sentence_upgrade":
      return answer === exercise.payload.correct;
    case "fill_connector":
      return (
        isIndexList(answer) &&
        sameSequence(
          answer,
          exercise.payload.gaps.map((g) => g.correct),
        )
      );
    case "sort_paragraphs":
    case "rank_arguments":
      return isIndexList(answer) && sameSequence(answer, exercise.payload.correct_order);
    case "complete_bbb":
      return answer === exercise.payload.correct;
    case "mark_parts":
      return isIndexList(answer) && sameSet(answer, exercise.payload.correct);
  }
}

/** A station is passed with 3 of 4 correct answers (spec 5). */
export function scoreStation(
  results: readonly boolean[],
  passThreshold: number = STATION_PASS_THRESHOLD,
): { correct: number; passed: boolean } {
  const correct = results.filter(Boolean).length;
  return { correct, passed: correct >= passThreshold };
}

/** Scores a whole attempt; answers are in the order of the drawn exercises. */
export function scoreAttempt(
  station: Pick<ExerciseStation, "passThreshold">,
  exercises: readonly Exercise[],
  answers: readonly unknown[],
): { results: boolean[]; correct: number; passed: boolean } {
  const results = exercises.map((ex, i) => scoreExercise(ex, answers[i]));
  return { results, ...scoreStation(results, station.passThreshold) };
}

/** Deterministic PRNG (mulberry32) seeded from a string (FNV-1a hash). */
export function seededRandom(seed: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type DrawResult =
  | { ok: true; exercises: Exercise[] }
  | { ok: false; reason: "pool_too_small"; available: number; needed: number };

/**
 * Draws a station: approved exercises of the station's stage and types, none of
 * the last 10 shown exercises. The same seed gives the same draw. When too few
 * fresh exercises exist, the result says so; the rule is never relaxed silently.
 */
export function drawStation(input: {
  station: Pick<ExerciseStation, "stufe" | "exerciseTypes" | "size">;
  pool: readonly Exercise[];
  /** Exercise ids the student saw, oldest first. */
  recentExerciseIds: readonly string[];
  seed: string;
}): DrawResult {
  const { station, pool, seed } = input;
  const recent = new Set(input.recentExerciseIds.slice(-NO_REPEAT_WINDOW));
  const candidates = pool
    .filter(
      (ex) =>
        ex.approved &&
        ex.stufe === station.stufe &&
        station.exerciseTypes.includes(ex.type) &&
        !recent.has(ex.id),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  if (candidates.length < station.size) {
    return { ok: false, reason: "pool_too_small", available: candidates.length, needed: station.size };
  }
  const random = seededRandom(seed);
  for (let i = 0; i < station.size; i++) {
    const j = i + Math.floor(random() * (candidates.length - i));
    [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
  }
  return { ok: true, exercises: candidates.slice(0, station.size) };
}

import { describe, expect, it } from "vitest";
import {
  drawStation,
  NO_REPEAT_WINDOW,
  scoreAttempt,
  scoreExercise,
  scoreStation,
  seededRandom,
} from "../domain/exercises.ts";
import type { Exercise, ExerciseType } from "../schemas/exercise.ts";
import { exerciseFileSchema } from "../schemas/exercise.ts";
import { readJson } from "./fixtures.ts";

const seed = exerciseFileSchema.parse(readJson("content/exercises/seed.json"));
const ex = (id: string): Exercise => seed.find((e) => e.id === id)!;

describe("scoreExercise", () => {
  const cases: { type: ExerciseType; id: string; right: unknown; wrong: unknown[] }[] = [
    { type: "sort_paragraphs", id: "ex-0001", right: [1, 3, 0, 2], wrong: [[0, 1, 2, 3], [1, 3, 0], [1, 3, 0, 2, 4]] },
    { type: "pick_thesis", id: "ex-0003", right: 0, wrong: [1, 2, "0"] },
    { type: "fill_connector", id: "ex-0006", right: [0, 0], wrong: [[0, 1], [0], 0] },
    { type: "rank_arguments", id: "ex-0007", right: [2, 1, 0], wrong: [[0, 1, 2], [2, 0, 1]] },
    { type: "complete_bbb", id: "ex-0009", right: "begruendung", wrong: ["beispiel", "behauptung", 1] },
    { type: "sentence_upgrade", id: "ex-0012", right: 1, wrong: [0, 2, [1]] },
    { type: "mark_parts", id: "ex-0014", right: [2, 5], wrong: [[2], [2, 5, 1], [2, 2, 5], [5, 5]] },
  ];

  for (const c of cases) {
    it(`scores ${c.type}`, () => {
      const exercise = ex(c.id);
      expect(exercise.type).toBe(c.type);
      expect(scoreExercise(exercise, c.right)).toBe(true);
      for (const w of c.wrong) expect(scoreExercise(exercise, w)).toBe(false);
    });
  }

  it("treats malformed answers as wrong", () => {
    for (const e of seed) {
      for (const junk of [undefined, null, {}, "x", [1.5], NaN]) expect(scoreExercise(e, junk)).toBe(false);
    }
  });

  it("ignores the order of marked segments", () => {
    expect(scoreExercise(ex("ex-0014"), [5, 2])).toBe(true);
  });
});

describe("station", () => {
  it("passes at 3 of 4", () => {
    expect(scoreStation([true, true, true, false])).toEqual({ correct: 3, passed: true });
    expect(scoreStation([true, false, true, false])).toEqual({ correct: 2, passed: false });
  });

  it("scores an attempt in the order of the drawn exercises", () => {
    const drawn = [ex("ex-0003"), ex("ex-0004"), ex("ex-0011"), ex("ex-0012")];
    expect(scoreAttempt({ passThreshold: 3 }, drawn, [0, 1, 0, 0])).toEqual({
      results: [true, true, true, false],
      correct: 3,
      passed: true,
    });
  });
});

describe("drawStation", () => {
  // Synthetic approved pool: 20 pick_thesis exercises on stage 3.
  const base = ex("ex-0003");
  const pool: Exercise[] = Array.from({ length: 20 }, (_, i) => ({
    ...base,
    id: `ex-${String(9000 + i)}`,
    approved: true,
  }));
  const station = { stufe: 3 as const, exerciseTypes: ["pick_thesis" as const], size: 4 };

  it("is deterministic for a seed", () => {
    const a = drawStation({ station, pool, recentExerciseIds: [], seed: "run-1" });
    const b = drawStation({ station, pool: [...pool].reverse(), recentExerciseIds: [], seed: "run-1" });
    expect(a).toEqual(b);
    expect(seededRandom("x")()).toBe(seededRandom("x")());
  });

  it("draws approved exercises of the station's stage and types only", () => {
    const mixed = [...pool.slice(0, 3), { ...pool[3]!, approved: false }, { ...pool[4]!, stufe: 4 as const }, ...seed];
    const result = drawStation({ station, pool: mixed, recentExerciseIds: [], seed: "s" });
    expect(result).toEqual({ ok: false, reason: "pool_too_small", available: 3, needed: 4 });
  });

  it("never repeats an exercise within the last 10", () => {
    const history: string[] = [];
    for (let i = 0; i < 40; i++) {
      const result = drawStation({ station, pool, recentExerciseIds: history, seed: `draw-${i}` });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      for (const e of result.exercises) {
        expect(history.slice(-NO_REPEAT_WINDOW)).not.toContain(e.id);
        expect(result.exercises.filter((x) => x.id === e.id)).toHaveLength(1);
      }
      history.push(...result.exercises.map((e) => e.id));
    }
  });

  it("reports a pool that is too small instead of repeating", () => {
    const small = pool.slice(0, 13);
    const recent = small.slice(0, 10).map((e) => e.id);
    expect(drawStation({ station, pool: small, recentExerciseIds: recent, seed: "s" })).toEqual({
      ok: false,
      reason: "pool_too_small",
      available: 3,
      needed: 4,
    });
  });
});

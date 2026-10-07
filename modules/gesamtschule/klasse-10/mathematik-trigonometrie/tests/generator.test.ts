import { describe, expect, it } from "vitest";
import { acceptsValue, roundTo } from "../domain/compare.ts";
import { drawParameters, isAmbiguous, isDegenerate } from "../domain/generator.ts";
import { MISCONCEPTIONS } from "../domain/misconceptions.ts";
import { createRng, drawOnGrid, fnv1a } from "../domain/random.ts";
import { levelsOf, type Task } from "../domain/schema.ts";
import { solve, type Params } from "../domain/solutions.ts";
import { TASKS, getTask } from "../domain/tasks.ts";

const SEEDS = Array.from({ length: 2000 }, (_, i) => `student-${i}`);
const L4A2 = getTask("L4-A2");

/**
 * Independent check of a draw: for every level and sought value, no wrong path of an expected
 * final-value misconception may be accepted as correct, neither exact nor rounded.
 */
function ambiguities(task: Task, params: Params): string[] {
  const found: string[] = [];
  for (const level of levelsOf(task)) {
    const solution = solve(task.solution_fn, params, level);
    if (solution.kind !== "numeric") continue;
    for (const quantity of task.levels[level]?.sought ?? []) {
      const correct = solution.values[quantity] ?? Number.NaN;
      const unit = solution.units[quantity] ?? "";
      for (const path of solution.wrongPaths) {
        const guarded = path.codes.some(
          (code) => MISCONCEPTIONS[code].detection === "final_value" && task.expected_misconceptions.includes(code),
        );
        const wrong = path.values[quantity];
        if (!guarded || wrong === undefined) continue;
        const forms = [wrong, roundTo(wrong, 2)];
        if (unit !== "") forms.push(roundTo(wrong, 1));
        if (unit === "°") forms.push(roundTo(wrong, 0));
        if (forms.some((w) => acceptsValue(w, correct, unit, task.tolerance))) found.push(`${level} ${quantity} ${path.id}`);
      }
    }
  }
  return found;
}

describe("random", () => {
  it("hashes strings with FNV-1a", () => {
    expect(fnv1a("")).toBe(0x811c9dc5);
    expect(fnv1a("a")).toBe(0xe40c292c);
  });

  it("is deterministic and in [0, 1)", () => {
    const a = createRng("seed");
    const b = createRng("seed");
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("draws only grid values and reaches both ends", () => {
    const rng = createRng("grid");
    const range = { min: 1.2, max: 2, step: 0.1, unit: "m" };
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(drawOnGrid(range, rng));
    expect([...seen].sort((x, y) => x - y)).toEqual([1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2]);
  });
});

describe("drawParameters", () => {
  it("is deterministic: same seed and attempt give the same parameters", () => {
    for (const seed of SEEDS.slice(0, 50)) {
      expect(drawParameters(L4A2, seed, 0)).toEqual(drawParameters(L4A2, seed, 0));
      expect(drawParameters(L4A2, seed, 3)).toEqual(drawParameters(L4A2, seed, 3));
    }
  });

  it("gives different parameters for different seeds and attempts", () => {
    const bySeed = new Set(SEEDS.slice(0, 200).map((seed) => JSON.stringify(drawParameters(L4A2, seed, 0))));
    expect(bySeed.size).toBeGreaterThan(150);
    const byAttempt = new Set(Array.from({ length: 20 }, (_, n) => JSON.stringify(drawParameters(L4A2, "student-1", n))));
    expect(byAttempt.size).toBeGreaterThan(15);
  });

  it("stays on the parameter grid", () => {
    for (const seed of SEEDS.slice(0, 200)) {
      const { c, alpha } = drawParameters(L4A2, seed, 0);
      expect(Number.isInteger(((c ?? 0) - 6) / 0.5)).toBe(true);
      expect(Number.isInteger(alpha)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(6);
      expect(c).toBeLessThanOrEqual(12);
      expect(alpha).toBeGreaterThanOrEqual(25);
      expect(alpha).toBeLessThanOrEqual(65);
    }
  });

  it.each(TASKS.map((task) => [task.id, task] as const))(
    "%s: no draw over 2000 seeds is ambiguous or degenerate",
    (_id, task) => {
      for (const seed of SEEDS) {
        const params = drawParameters(task, seed, 0);
        expect(ambiguities(task, params)).toEqual([]);
        expect(isDegenerate(task, params)).toBe(false);
      }
    },
  );

  it("L4-A2 never yields α = 45°", () => {
    const alphas = new Set(SEEDS.flatMap((seed) => [0, 1].map((attempt) => drawParameters(L4A2, seed, attempt).alpha)));
    expect(alphas.has(45)).toBe(false);
    expect(alphas.size).toBeGreaterThan(30);
  });

  it("throws after a bounded number of draws when every draw is ambiguous", () => {
    const only45: Task = { ...L4A2, parameters: { ...L4A2.parameters, alpha: { min: 45, max: 45, step: 1, unit: "°" } } };
    expect(() => drawParameters(only45, "student-1", 0)).toThrow(/no unambiguous parameters/);
  });
});

describe("ambiguity guard", () => {
  it("rejects α = 45° in L4-A2: cos instead of sin gives the right value", () => {
    expect(isAmbiguous(L4A2, { c: 8, alpha: 45 })).toBe(true);
    expect(ambiguities(L4A2, { c: 8, alpha: 45 })).toContain("G a sin_cos_swapped");
  });

  it("rejects α = 38° in L4-A2: tan 38° and cos 38° differ by less than 1 %", () => {
    expect(isAmbiguous(L4A2, { c: 8, alpha: 38 })).toBe(true);
  });

  it("accepts the spec example c = 8 cm, α = 35°", () => {
    expect(isAmbiguous(L4A2, { c: 8, alpha: 35 })).toBe(false);
  });

  it("ignores F5: early rounding is detected through intermediate values", () => {
    // sin 37° = 0.6018: rounded to 0.6 the result stays within 1 %, still not ambiguous.
    expect(isAmbiguous(L4A2, { c: 8, alpha: 37 })).toBe(false);
  });

  it("agrees with the independent check on the whole L4-A2 grid", () => {
    for (let c = 6; c <= 12; c += 0.5) {
      for (let alpha = 25; alpha <= 65; alpha++) {
        expect(isAmbiguous(L4A2, { c, alpha })).toBe(ambiguities(L4A2, { c, alpha }).length > 0);
      }
    }
  });
});

describe("degenerate values", () => {
  it("rejects zero lengths, angles of 0° or 90° and impossible triangles", () => {
    expect(isDegenerate(L4A2, { c: 0, alpha: 35 })).toBe(true);
    expect(isDegenerate(L4A2, { c: 8, alpha: 0 })).toBe(true);
    expect(isDegenerate(L4A2, { c: 8, alpha: 90 })).toBe(true);
    expect(isDegenerate(L4A2, { c: 8, alpha: 35 })).toBe(false);
    expect(isDegenerate(getTask("L6-A2"), { ladder: 4, distance: 4 })).toBe(true);
    expect(isDegenerate(getTask("L5-A2"), { c: 6, a: 10 })).toBe(true);
  });
});

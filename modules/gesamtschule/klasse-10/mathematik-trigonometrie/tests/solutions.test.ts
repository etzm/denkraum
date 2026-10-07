import { describe, expect, it } from "vitest";
import type { Niveau } from "@denkraum/core";
import { renderHint } from "../domain/misconceptions.ts";
import { arc, solve, trig, type NumericSolution, type Params, type WrongPath } from "../domain/solutions.ts";
import { TASKS } from "../domain/tasks.ts";

/** All values of spec A 4.2, recomputed (docs/umsetzungsplan.md, section 6.1). */

function numeric(fn: string, params: Params, level: Niveau = "M"): NumericSolution {
  const solution = solve(fn, params, level);
  if (solution.kind !== "numeric") throw new Error(`${fn} is not numeric`);
  return solution;
}

function path(solution: NumericSolution, id: string): WrongPath {
  const found = solution.wrongPaths.find((p) => p.id === id);
  if (!found) throw new Error(`no wrong path ${id}`);
  return found;
}

function withCode(solution: NumericSolution, code: string): WrongPath[] {
  return solution.wrongPaths.filter((p) => p.codes.some((c) => c === code));
}

describe("calculator model", () => {
  it("computes sin 30° in DEG, RAD and GRAD mode", () => {
    expect(trig("sin", 30)).toBeCloseTo(0.5, 12);
    expect(trig("sin", 30, "rad")).toBeCloseTo(-0.988, 3);
    expect(trig("sin", 30, "grad")).toBeCloseTo(0.454, 3);
  });

  it("returns inverse functions in the unit of the mode", () => {
    expect(arc("tan", 1)).toBeCloseTo(45, 12);
    expect(arc("tan", 1, "rad")).toBeCloseTo(Math.PI / 4, 12);
    expect(arc("tan", 1, "grad")).toBeCloseTo(50, 12);
  });
});

describe("L1-A1: similar triangles, k = 2.5", () => {
  const s = numeric("L1-A1", { a1: 3, b1: 4, c1: 5, k: 2.5 });

  it("gives the sides 7.5 cm, 10 cm, 12.5 cm", () => {
    expect(s.values.a2).toBeCloseTo(7.5, 10);
    expect(s.values.b2).toBeCloseTo(10, 10);
    expect(s.values.c2).toBeCloseTo(12.5, 10);
  });

  it("gives the ratio 3/5 = 7.5/12.5 = 0.6 in both triangles", () => {
    expect(s.values.ratio_1).toBeCloseTo(0.6, 10);
    expect(s.values.ratio_2).toBeCloseTo(0.6, 10);
    expect(s.values.ratio).toBeCloseTo(0.6, 10);
  });

  it("F8: short leg divided by long leg gives 0.75", () => {
    expect(path(s, "leg_as_hypotenuse").values.ratio).toBeCloseTo(0.75, 10);
  });
});

describe("L1-A2: stick and tree", () => {
  const s = numeric("L1-A2", { stick: 1.5, stick_shadow: 2, tree_shadow: 12 });

  it("gives h = 1.5/2 · 12 = 9 m", () => {
    expect(s.values.ratio).toBeCloseTo(0.75, 10);
    expect(s.values.h).toBeCloseTo(9, 10);
  });

  it("F6: divided instead of multiplied gives 16 m; F10: partial segment gives 7.5 m", () => {
    expect(path(s, "divided_by_ratio").values.h).toBeCloseTo(16, 10);
    expect(path(s, "partial_segment").values.h).toBeCloseTo(7.5, 10);
  });
});

describe("L3-A1 and L3-A2: values and calculator check", () => {
  const s = numeric("L3-A1", {});

  it("gives sin 30° = 0.5, tan 45° = 1, cos 60° = 0.5, sin 45° ≈ 0.7071", () => {
    expect(s.values.sin30).toBeCloseTo(0.5, 10);
    expect(s.values.tan45).toBeCloseTo(1, 10);
    expect(s.values.cos60).toBeCloseTo(0.5, 10);
    expect(s.values.sin45).toBeCloseTo(0.7071, 4);
  });

  it("F1: sin 30° in RAD mode gives about -0.988", () => {
    expect(path(s, "rad_mode").values.sin30).toBeCloseTo(-0.988, 3);
    const check = numeric("L3-A2", {});
    expect(check.values.sin30).toBeCloseTo(0.5, 10);
    expect(path(check, "rad_mode").values.sin30).toBeCloseTo(-0.988, 3);
  });
});

describe("L4-A2: c = 8 cm, α = 35°", () => {
  const s = numeric("L4-A2", { c: 8, alpha: 35 });

  it("gives a = 8 · sin 35° ≈ 4.59 cm and b = 8 · cos 35° ≈ 6.55 cm", () => {
    expect(s.values.sin_alpha).toBeCloseTo(0.5736, 4);
    expect(s.values.a).toBeCloseTo(4.5886, 4);
    expect(s.values.a).toBeCloseTo(4.59, 2);
    expect(s.values.b).toBeCloseTo(6.5532, 4);
    expect(s.values.b).toBeCloseTo(6.55, 2);
  });

  it("checks with Pythagoras: 64.00 exactly, 4.59² + 6.55² ≈ 64.0 with rounded values", () => {
    expect(s.values.pythagoras_check).toBeCloseTo(64, 10);
    expect(4.59 ** 2 + 6.55 ** 2).toBeCloseTo(63.97, 2);
    expect(4.59 ** 2 + 6.55 ** 2).toBeCloseTo(64.0, 1);
  });

  it("G variant gives the same a", () => {
    expect(numeric("L4-A2", { c: 8, alpha: 35 }, "G").values.a).toBeCloseTo(4.59, 2);
  });

  it("F1 RAD path: a ≈ -3.43 cm, a negative length", () => {
    const rad = path(s, "rad_mode");
    expect(rad.values.a).toBeCloseTo(-3.4255, 4);
    expect(rad.values.a).toBeCloseTo(-3.43, 2);
    expect(rad.values.a).toBeLessThan(0);
  });

  it("F1 GRAD path, F2/F3 swapped, F3 tan, F6 rearrangement", () => {
    expect(path(s, "grad_mode").values.a).toBeCloseTo(8 * Math.sin((35 * Math.PI) / 200), 10);
    const swapped = path(s, "sin_cos_swapped");
    expect(swapped.codes).toEqual(["F2", "F3"]);
    expect(swapped.values.a).toBeCloseTo(6.55, 2);
    expect(path(s, "tan_instead").values.a).toBeCloseTo(5.60, 2);
    expect(path(s, "ratio_divided_by_c").values.a).toBeCloseTo(0.0717, 4);
    expect(path(s, "c_divided_by_ratio").values.a).toBeCloseTo(13.95, 2);
  });

  it("F5 path: sin 35° rounded to 0.6 gives a = 4.8 cm", () => {
    expect(path(s, "early_rounding_sin_alpha_1").values.a).toBeCloseTo(4.8, 10);
    expect(path(s, "early_rounding_sin_alpha_2").values.a).toBeCloseTo(4.56, 10);
  });
});

describe("L4-A3: c = 10 cm, β = 50°", () => {
  it("gives b = 10 · sin 50° ≈ 7.66 cm", () => {
    const s = numeric("L4-A3", { c: 10, beta: 50 });
    expect(s.values.b).toBeCloseTo(7.66, 2);
    expect(path(s, "cos_instead_of_sin").values.b).toBeCloseTo(6.43, 2);
  });
});

describe("L5-A1: a = 3 cm, b = 5 cm", () => {
  const s = numeric("L5-A1", { a: 3, b: 5 });

  it("gives tan α = 0.6, α ≈ 30.96° ≈ 31.0°, β ≈ 59.04° ≈ 59.0°", () => {
    expect(s.values.tan_alpha).toBeCloseTo(0.6, 10);
    expect(s.values.alpha).toBeCloseTo(30.96, 2);
    expect(s.values.alpha).toBeCloseTo(31.0, 1);
    expect(s.values.beta).toBeCloseTo(59.04, 2);
    expect(s.values.beta).toBeCloseTo(59.0, 1);
  });

  it("F2: tan⁻¹(5/3) ≈ 59.04° for α", () => {
    expect(path(s, "legs_swapped").values.alpha).toBeCloseTo(59.04, 2);
  });

  it("F4: tan(0.6), 1/0.6 and 1/tan(0.6) instead of tan⁻¹(0.6)", () => {
    const alphas = withCode(s, "F4").map((p) => p.values.alpha);
    expect(alphas).toHaveLength(3);
    expect(alphas[0]).toBeCloseTo(0.0105, 4);
    expect(alphas[1]).toBeCloseTo(1.667, 3);
    expect(alphas[2]).toBeCloseTo(95.49, 2);
  });
});

describe("L5-A2: hypotenuse 10 cm, opposite 6 cm", () => {
  it("gives sin α = 0.6, α ≈ 36.87°", () => {
    const s = numeric("L5-A2", { c: 10, a: 6 }, "G");
    expect(s.values.sin_alpha).toBeCloseTo(0.6, 10);
    expect(s.values.alpha).toBeCloseTo(36.87, 2);
  });
});

describe("L6-A1: tower, 50 m, 32°, eye height 1.60 m", () => {
  it("gives h = 50 · tan 32° + 1.6 ≈ 31.24 + 1.6 ≈ 32.8 m", () => {
    const s = numeric("L6-A1", { d: 50, alpha: 32, eye: 1.6 }, "M");
    expect(s.values.x).toBeCloseTo(31.24, 2);
    expect(s.values.h).toBeCloseTo(32.84, 2);
    expect(s.values.h).toBeCloseTo(32.8, 1);
  });

  it("G variant without eye height gives ≈ 31.2 m", () => {
    const s = numeric("L6-A1", { d: 50, alpha: 32, eye: 1.6 }, "G");
    expect(s.values.h).toBeCloseTo(31.24, 2);
    expect(s.values.h).toBeCloseTo(31.2, 1);
  });
});

describe("L6-A2: ladder 4 m, 1.2 m from the wall", () => {
  const s = numeric("L6-A2", { ladder: 4, distance: 1.2 });

  it("gives cos α = 0.3, α ≈ 72.5°, height ≈ 3.82 m on both ways", () => {
    expect(s.values.cos_alpha).toBeCloseTo(0.3, 10);
    expect(s.values.alpha).toBeCloseTo(72.54, 2);
    expect(s.values.alpha).toBeCloseTo(72.5, 1);
    expect(s.values.h).toBeCloseTo(3.82, 2);
    expect(s.values.h_pythagoras).toBeCloseTo(3.82, 2);
    expect(Math.sqrt(16 - 1.44)).toBeCloseTo(s.values.h ?? Number.NaN, 10);
  });

  it("F8: Pythagoras with the ladder as a leg gives √(16 + 1.44) ≈ 4.18 m", () => {
    expect(path(s, "ladder_as_leg").values.h).toBeCloseTo(4.18, 2);
  });
});

describe("L6-A3: 12 % gradient", () => {
  const s = numeric("L6-A3", { p: 12 });

  it("gives tan α = 0.12, α ≈ 6.8°", () => {
    expect(s.values.tan_alpha).toBeCloseTo(0.12, 10);
    expect(s.values.alpha).toBeCloseTo(6.84, 2);
    expect(s.values.alpha).toBeCloseTo(6.8, 1);
  });

  it("F12: 12 % read as 12°", () => {
    const f12 = path(s, "percent_as_degrees");
    expect(f12.codes).toEqual(["F12"]);
    expect(f12.values.alpha).toBe(12);
  });

  it("has no F3 path: sin⁻¹(0.12) ≈ 6.89° lies within 0.5° of the right angle", () => {
    expect(arc("sin", 0.12) - (s.values.alpha ?? 0)).toBeLessThan(0.5);
    expect(withCode(s, "F3")).toHaveLength(0);
  });
});

describe("L7-A1: derivation of sin²α + cos²α = 1", () => {
  it("is a checklist with the four expected steps", () => {
    const s = solve("L7-A1", {}, "E");
    expect(s.kind).toBe("checklist");
    if (s.kind !== "checklist") return;
    expect(s.steps.map((step) => step.id)).toEqual(["pythagoras", "divide_by_c_squared", "ratios_squared", "definitions"]);
  });
});

describe("all tasks", () => {
  it("every wrong path renders the hints of its codes", () => {
    for (const task of TASKS) {
      const params = Object.fromEntries(Object.entries(task.parameters).map(([k, r]) => [k, r.min]));
      const solution = solve(task.solution_fn, params, "E");
      if (solution.kind !== "numeric") continue;
      for (const p of solution.wrongPaths) {
        for (const code of p.codes) expect(() => renderHint(code, p.hint_vars)).not.toThrow();
      }
    }
  });

  it("renders the parametrised hints", () => {
    expect(renderHint("F4", { fn: "tan" })).toBe("Du suchst den Winkel, also brauchst du tan⁻¹ (SHIFT + tan).");
    expect(renderHint("F12", { percent: "12" })).toBe(
      "12 % Steigung heißt 12 m hoch auf 100 m waagerecht. Welches Verhältnis ist das?",
    );
    expect(() => renderHint("F6")).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import type { Niveau } from "@denkraum/core";
import { drawParameters } from "../domain/generator.ts";
import type { TranscribedTask } from "../domain/schema.ts";
import { solve, type NumericSolution, type Params, type WrongPath } from "../domain/solutions.ts";
import { getTask } from "../domain/tasks.ts";
import { verify } from "../domain/verify.ts";

/** Lesson 4 task bank (A1): values recomputed by hand and fixed here, wrong paths and their detection. */

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

function paper(taskId: string, answers: [string, number | null, string | null][], fields: Partial<TranscribedTask> = {}): TranscribedTask {
  return {
    task_id: taskId,
    found: true,
    sketch_present: true,
    sketch_labels_ok: "ok",
    approach: null,
    intermediate_values: [],
    final_answers: answers.map(([quantity, value, unit]) => ({ quantity, value, unit })),
    answer_sentence_present: true,
    transcription_confidence: 0.9,
    raw_text: "",
    ...fields,
  };
}

describe("L4-A1: worked example, c = 5 cm, α = 40°", () => {
  const task = getTask("L4-A1");
  const params = drawParameters(task, "any", 0);

  it("has fixed numbers and uses the solution of L4-A2", () => {
    expect(params).toEqual({ c: 5, alpha: 40 });
    expect(task.solution_fn).toBe("L4-A2");
  });

  it("gives a = 5 · sin 40° ≈ 3.21 cm, b = 5 · cos 40° ≈ 3.83 cm, a² + b² = 25", () => {
    const s = numeric("L4-A2", params);
    expect(s.values.sin_alpha).toBeCloseTo(0.6428, 4);
    expect(s.values.a).toBeCloseTo(3.2139, 4);
    expect(s.values.b).toBeCloseTo(3.8302, 4);
    expect(s.values.pythagoras_check).toBeCloseTo(25, 10);
  });
});

describe("L4-A4: faded task, b = 6 cm, α = 35°", () => {
  const task = getTask("L4-A4");

  it("gives a = 6 · tan 35° ≈ 4.20 cm", () => {
    expect(drawParameters(task, "any", 0)).toEqual({ b: 6, alpha: 35 });
    expect(numeric("L4-A5", { b: 6, alpha: 35 }).values.a).toBeCloseTo(4.2012, 4);
  });

  it("hides the result on G, also the rearranging on M, also the approach on E", () => {
    expect(task.levels.G?.hidden_steps).toEqual([3]);
    expect(task.levels.M?.hidden_steps).toEqual([2, 3]);
    expect(task.levels.E?.hidden_steps).toEqual([1, 2, 3]);
  });
});

describe("L4-A5: opposite side from the adjacent side (tangent)", () => {
  const s = numeric("L4-A5", { b: 6, alpha: 35 });

  it("gives a = 6 · tan 35° ≈ 4.20 cm and c = √(a² + b²) ≈ 7.32 cm = 6 : cos 35°", () => {
    expect(s.values.tan_alpha).toBeCloseTo(0.7002, 4);
    expect(s.values.a).toBeCloseTo(4.2012, 4);
    expect(s.values.c).toBeCloseTo(7.3246, 4);
    expect(s.values.c).toBeCloseTo(6 / Math.cos((35 * Math.PI) / 180), 10);
  });

  it("computes the typical wrong paths", () => {
    expect(path(s, "rad_mode").values.a).toBeCloseTo(2.8429, 4);
    expect(path(s, "b_divided_by_tan").values.a).toBeCloseTo(8.5689, 4);
    expect(path(s, "b_divided_by_tan").codes).toEqual(["F2", "F6"]);
    expect(path(s, "sin_instead_of_tan").values.a).toBeCloseTo(3.4415, 4);
    expect(path(s, "cos_instead_of_tan").values.a).toBeCloseTo(4.9149, 4);
    // A wrong a carries over to c through Pythagoras.
    expect(path(s, "sin_instead_of_tan").values.c).toBeCloseTo(Math.hypot(3.44146, 6), 3);
    expect(path(s, "c_times_cos").values.c).toBeCloseTo(4.9149, 4);
    expect(path(s, "c_as_leg").values.c).toBeCloseTo(Math.sqrt(36 - 4.2012 ** 2), 3);
  });

  it("on G only a is sought, without the cosine", () => {
    const g = getTask("L4-A5").levels.G!;
    expect(g.sought).toEqual(["a"]);
    expect([g.text, ...g.steps].join(" ")).not.toMatch(/cos|kosinus/i);
  });
});

describe("L4-A6: hypotenuse from a side (division)", () => {
  const s = numeric("L4-A6", { a: 6, alpha: 40 });

  it("gives c = 6 : sin 40° ≈ 9.33 cm and b = 6 : tan 40° ≈ 7.15 cm", () => {
    expect(s.values.c).toBeCloseTo(9.3343, 4);
    expect(s.values.b).toBeCloseTo(7.1505, 4);
    expect(s.values.b ** 2 + 36).toBeCloseTo(s.values.c! ** 2, 8);
  });

  it("computes the typical wrong paths", () => {
    expect(path(s, "a_times_sin").values.c).toBeCloseTo(3.8567, 4);
    expect(path(s, "sin_divided_by_a").values.c).toBeCloseTo(0.1071, 4);
    expect(path(s, "cos_instead_of_sin").values.c).toBeCloseTo(7.8324, 4);
    expect(path(s, "rad_mode").values.b).toBeLessThan(0);
    expect(path(s, "a_times_tan").values.b).toBeCloseTo(5.0346, 4);
    expect(path(s, "b_as_hypotenuse").values.b).toBeCloseTo(11.0964, 4);
  });
});

describe("L4-A7: ladder (application)", () => {
  const s = numeric("L4-A7", { l: 4, alpha: 70 });

  it("gives h = 4 · sin 70° ≈ 3.76 m and d = 4 · cos 70° ≈ 1.37 m", () => {
    expect(s.values.h).toBeCloseTo(3.7588, 4);
    expect(s.values.d).toBeCloseTo(1.3681, 4);
    expect(s.values.h! ** 2 + s.values.d! ** 2).toBeCloseTo(16, 10);
  });

  it("computes the typical wrong paths", () => {
    expect(path(s, "sin_cos_swapped").values).toEqual({ h: s.values.d, d: s.values.h });
    expect(path(s, "rad_mode").values.h).toBeCloseTo(3.0956, 4);
    expect(path(s, "length_divided_by_ratio").values.h).toBeCloseTo(4.2567, 4);
    expect(path(s, "tan_instead").values.h).toBeCloseTo(10.9899, 4);
  });
});

describe("verify on the lesson 4 templates", () => {
  it("L4-A5: right values are correct; b : tan α gives F2 and F6, sin instead of tan gives F3", () => {
    const task = getTask("L4-A5");
    const p = { b: 6, alpha: 35 };
    expect(verify(task, p, "M", paper("L4-A5", [["a", 4.2, "cm"], ["c", 7.32, "cm"]])).status).toBe("correct");
    const swapped = verify(task, p, "G", paper("L4-A5", [["a", 8.57, "cm"]]));
    expect(swapped).toMatchObject({ status: "incorrect", matched_misconceptions: ["F2", "F6"] });
    expect(swapped.evidence.find((e) => e.code === "F6")?.hint_vars).toEqual({ side: "b" });
    expect(verify(task, p, "G", paper("L4-A5", [["a", 3.44, "cm"]])).matched_misconceptions).toEqual(["F3"]);
  });

  it("L4-A5: c with the ladder of Pythagoras the wrong way round gives F8", () => {
    const result = verify(getTask("L4-A5"), { b: 6, alpha: 35 }, "E", paper("L4-A5", [["a", 4.2, "cm"], ["c", 4.28, "cm"]]));
    expect(result).toMatchObject({ status: "incorrect", matched_misconceptions: ["F8"] });
  });

  it("L4-A6: c = a · sin α gives F6 with the hint to multiply by c", () => {
    const result = verify(getTask("L4-A6"), { a: 6, alpha: 40 }, "G", paper("L4-A6", [["c", 3.86, "cm"]]));
    expect(result).toMatchObject({ status: "incorrect", matched_misconceptions: ["F6"] });
    expect(result.evidence.find((e) => e.code === "F6")?.hint_vars).toEqual({ side: "c" });
  });

  it("L4-A7: RAD mode gives F1; a missing unit gives F7 and partially_correct", () => {
    const task = getTask("L4-A7");
    const p = { l: 4, alpha: 70 };
    expect(verify(task, p, "G", paper("L4-A7", [["h", 3.1, "m"]])).matched_misconceptions).toEqual(["F1"]);
    expect(verify(task, p, "G", paper("L4-A7", [["h", 3.76, null]]))).toMatchObject({
      status: "partially_correct",
      matched_misconceptions: ["F7"],
    });
  });

  it("a missing sketch is F11, not a reason for incorrect (spec A 2.9)", () => {
    const result = verify(getTask("L4-A7"), { l: 4, alpha: 70 }, "M", paper("L4-A7", [["h", 3.76, "m"], ["d", 1.37, "m"]], { sketch_present: false }));
    expect(result).toMatchObject({ status: "partially_correct", matched_misconceptions: ["F11"] });
  });

  it("every paper template is correct for the model values on every level, over many seeds", () => {
    for (const id of ["L4-A2", "L4-A5", "L4-A6", "L4-A7"]) {
      const task = getTask(id);
      for (let i = 0; i < 200; i++) {
        const params = drawParameters(task, `seed-${i}`, 1);
        for (const level of ["G", "M", "E"] as const) {
          const s = numeric(task.solution_fn, params, level);
          const answers = task.levels[level]!.sought.map((q): [string, number, string] => [q, Math.round(s.values[q]! * 100) / 100, s.units[q]!]);
          expect(verify(task, params, level, paper(id, answers)).status, `${id} ${level} ${JSON.stringify(params)}`).toBe("correct");
        }
      }
    }
  });
});

import { describe, expect, it } from "vitest";
import l1 from "../content/tasks/L1.json" with { type: "json" };
import l3 from "../content/tasks/L3.json" with { type: "json" };
import l4 from "../content/tasks/L4.json" with { type: "json" };
import l5 from "../content/tasks/L5.json" with { type: "json" };
import l6 from "../content/tasks/L6.json" with { type: "json" };
import l7 from "../content/tasks/L7.json" with { type: "json" };
import {
  BILDUNGSPLAN_LEVELS,
  SIN_TAN_ONLY_ON_G,
  bildungsplanFor,
  levelsOf,
  taskFileSchema,
  taskSchema,
  type Task,
} from "../domain/schema.ts";
import { TASKS, TASK_FILES, checkTask, getTask, loadTasks } from "../domain/tasks.ts";

const SPEC_TASKS = ["L1-A1", "L1-A2", "L3-A1", "L3-A2", "L4-A2", "L4-A3", "L5-A1", "L5-A2", "L6-A1", "L6-A2", "L6-A3", "L7-A1"];
const CODE_17 = "BP2016BW_ALLG_SEK1_M_IK_7-8-9_03(17)";
const CODE_10_2 = "BP2016BW_ALLG_SEK1_M_IK_10_03(2)";

/** A deep copy of a valid task as plain JSON, to break in tests. */
function raw(id: string): Record<string, any> {
  return JSON.parse(JSON.stringify(getTask(id)));
}

describe("task files", () => {
  it.each(Object.entries({ L1: l1, L3: l3, L4: l4, L5: l5, L6: l6, L7: l7 }))("%s.json validates", (_name, data) => {
    expect(() => taskFileSchema.parse(data)).not.toThrow();
  });

  it("contain all example tasks of spec A 4.2", () => {
    expect(TASKS.map((t) => t.id)).toEqual(SPEC_TASKS);
  });

  it("are consistent with the solution functions", () => {
    for (const task of TASKS) expect(checkTask(task), task.id).toEqual([]);
  });

  it("use the levels of spec A 4.2", () => {
    const levels = Object.fromEntries(TASKS.map((t) => [t.id, levelsOf(t).join("")]));
    expect(levels).toMatchObject({ "L5-A1": "ME", "L5-A2": "G", "L6-A2": "ME", "L6-A3": "ME", "L7-A1": "E", "L4-A2": "GME" });
  });

  it("contain no en or em dash", () => {
    expect(JSON.stringify(TASK_FILES)).not.toMatch(/[\u2013\u2014]/);
  });

  it.todo("each lesson has 1 worked example, 2 faded tasks and 4 paper tasks in G, M, E (phase A2)");
});

describe("Bildungsplan level constraints", () => {
  it("hold for every task and level", () => {
    for (const task of TASKS) {
      for (const level of levelsOf(task)) {
        for (const code of bildungsplanFor(task, level)) {
          expect(BILDUNGSPLAN_LEVELS[code], `${task.id} ${level} ${code}`).toContain(level);
        }
      }
    }
  });

  it("(17) Ähnlichkeitssätze never on G, 10_03(2) only on E", () => {
    for (const task of TASKS) {
      if (task.levels.G) expect(bildungsplanFor(task, "G")).not.toContain(CODE_17);
      for (const level of levelsOf(task)) {
        if (level !== "E") expect(bildungsplanFor(task, level)).not.toContain(CODE_10_2);
      }
    }
    expect(bildungsplanFor(getTask("L1-A2"), "E")).toContain(CODE_17);
    expect(bildungsplanFor(getTask("L7-A1"), "E")).toContain(CODE_10_2);
  });

  it("10_03(1) on G uses sine and tangent only", () => {
    for (const task of TASKS) {
      const g = task.levels.G;
      if (!g || !bildungsplanFor(task, "G").includes(SIN_TAN_ONLY_ON_G)) continue;
      const texts = [g.text, ...g.steps, g.extra ?? "", ...task.hints].join(" ");
      expect(texts, task.id).not.toMatch(/cos|kosinus/i);
    }
  });

  it("rejects (17) on level G", () => {
    const task = raw("L1-A2");
    task.levels.G.bildungsplan = [CODE_17];
    expect(taskSchema.safeParse(task).success).toBe(false);
  });

  it("rejects 10_03(2) on level M", () => {
    const task = raw("L7-A1");
    task.levels.M = { ...task.levels.E };
    expect(taskSchema.safeParse(task).success).toBe(false);
  });

  it("rejects cosine on level G under 10_03(1)", () => {
    const task = raw("L4-A2");
    task.levels.G.text += " Berechne auch b mit dem Kosinus.";
    expect(taskSchema.safeParse(task).success).toBe(false);
    const hint = raw("L4-A2");
    hint.hints.push("Denk an cos α = b/c.");
    expect(taskSchema.safeParse(hint).success).toBe(false);
  });

  it("rejects codes outside the verified list", () => {
    const task = raw("L4-A2");
    task.bildungsplan = ["BP2016BW_ALLG_SEK1_M_IK_10_03(3)"];
    expect(taskSchema.safeParse(task).success).toBe(false);
  });
});

describe("task schema", () => {
  const broken = (id: string, change: (task: Record<string, any>) => void) => {
    const task = raw(id);
    change(task);
    return taskSchema.safeParse(task).success;
  };

  it("accepts a valid task", () => {
    expect(taskSchema.safeParse(raw("L4-A2")).success).toBe(true);
  });

  it("requires at least one level", () => {
    expect(broken("L4-A2", (t) => (t.levels = {}))).toBe(false);
  });

  it("checks parameter ranges and types", () => {
    expect(broken("L4-A2", (t) => (t.parameters.c = { min: 6, max: 12, step: 0.7, unit: "cm" }))).toBe(false);
    expect(broken("L4-A2", (t) => (t.parameters.c = { min: 12, max: 6, step: 0.5, unit: "cm" }))).toBe(false);
    expect(broken("L4-A2", (t) => (t.type = "homework"))).toBe(false);
    expect(broken("L4-A2", (t) => (t.unknown_field = true))).toBe(false);
  });

  it("checks hidden steps, ids and paper-only flags", () => {
    expect(broken("L4-A3", (t) => (t.levels.G.hidden_steps = [9]))).toBe(false);
    expect(broken("L4-A2", (t) => (t.id = "L5-A2"))).toBe(false);
    expect(broken("L4-A3", (t) => (t.requires_sketch = true))).toBe(false);
  });
});

describe("checkTask", () => {
  const problems = (id: string, change: (task: Task) => void) => {
    const task = taskSchema.parse(raw(id));
    change(task);
    return checkTask(task);
  };

  it("finds unknown solution functions, sought values and placeholders", () => {
    expect(problems("L4-A2", (t) => (t.solution_fn = "L9-A9"))).toHaveLength(1);
    expect(problems("L4-A2", (t) => t.levels.G?.sought.push("z")).join()).toMatch(/sought "z"/);
    expect(problems("L4-A2", (t) => t.levels.G && (t.levels.G.text += " {{gamma}}")).join()).toMatch(/\{\{gamma\}\}/);
  });

  it("finds parameters that do not match the solution function", () => {
    expect(problems("L4-A2", (t) => delete t.parameters.alpha).join()).toMatch(/do not match/);
  });

  it("finds wrong-path codes missing in expected_misconceptions", () => {
    const found = problems("L4-A2", (t) => (t.expected_misconceptions = t.expected_misconceptions.filter((c) => c !== "F6")));
    expect(found.join()).toMatch(/F6/);
  });

  it("requires F7 and F11 exactly when they are checked", () => {
    expect(problems("L4-A2", (t) => (t.expected_misconceptions = t.expected_misconceptions.filter((c) => c !== "F11")))).not.toEqual([]);
    expect(problems("L3-A1", (t) => t.expected_misconceptions.push("F7"))).not.toEqual([]);
  });

  it("loadTasks rejects duplicate ids and tasks in the wrong file", () => {
    expect(() => loadTasks({ "L4.json": [...l4, ...l4] })).toThrow(/duplicate task id/);
    expect(() => loadTasks({ "L5.json": l4 })).toThrow(/belongs to L4.json/);
  });
});

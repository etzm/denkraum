import { z } from "zod";
import l1 from "../content/tasks/L1.json" with { type: "json" };
import l3 from "../content/tasks/L3.json" with { type: "json" };
import l4 from "../content/tasks/L4.json" with { type: "json" };
import l5 from "../content/tasks/L5.json" with { type: "json" };
import l6 from "../content/tasks/L6.json" with { type: "json" };
import l7 from "../content/tasks/L7.json" with { type: "json" };
import { MISCONCEPTIONS, hintVariables } from "./misconceptions.ts";
import { levelsOf, taskFileSchema, type Task } from "./schema.ts";
import { solutionInfo, solve, type Params } from "./solutions.ts";
import { placeholders } from "./template.ts";

/** Raw task files by file name. The file name must match the lesson: L4.json holds lesson 4. */
export const TASK_FILES: Readonly<Record<string, unknown>> = {
  "L1.json": l1,
  "L3.json": l3,
  "L4.json": l4,
  "L5.json": l5,
  "L6.json": l6,
  "L7.json": l7,
};

/**
 * Consistency of a schema-valid task with its solution function. Returns the problems found.
 * - solution_fn exists, parameter names match, sought values exist, placeholders resolve
 * - every final-value code of a wrong path is listed in expected_misconceptions (so the generator guards it)
 * - F7 and F11 are listed exactly when the task checks unit, answer sentence or sketch
 * - every wrong path supplies the variables its hint templates need
 */
export function checkTask(task: Task): string[] {
  const problems: string[] = [];
  const info = solutionInfo(task.solution_fn);
  if (!info) return [`unknown solution_fn "${task.solution_fn}"`];

  const declared = Object.keys(task.parameters).sort();
  const required = [...info.params].sort();
  if (declared.join() !== required.join()) {
    problems.push(`parameters [${declared.join(", ")}] do not match solution parameters [${required.join(", ")}]`);
    return problems;
  }

  const sample: Params = Object.fromEntries(Object.entries(task.parameters).map(([key, range]) => [key, range.min]));
  const expected = new Set(task.expected_misconceptions);
  let checksUnit = false;

  for (const level of levelsOf(task)) {
    const def = task.levels[level];
    if (!def) continue;
    const solution = solve(task.solution_fn, sample, level);
    const valueKeys = solution.kind === "numeric" ? Object.keys(solution.values) : [];

    if (solution.kind === "checklist" && def.sought.length > 0) problems.push(`${level}: checklist tasks have no sought values`);
    if (solution.kind === "numeric" && def.sought.length === 0) problems.push(`${level}: sought must not be empty`);
    for (const key of def.sought) {
      if (!valueKeys.includes(key)) problems.push(`${level}: sought "${key}" is not a solution value`);
      if (solution.kind === "numeric" && task.type === "paper" && (solution.units[key] ?? "") !== "") checksUnit = true;
    }

    const known = new Set([...Object.keys(task.parameters), ...valueKeys]);
    for (const text of [def.text, ...def.steps, def.extra ?? "", ...task.hints]) {
      for (const name of placeholders(text)) {
        if (!known.has(name)) problems.push(`${level}: unknown placeholder {{${name}}}`);
      }
    }

    if (solution.kind !== "numeric") continue;
    for (const path of solution.wrongPaths) {
      for (const code of path.codes) {
        if (MISCONCEPTIONS[code].detection === "final_value" && !expected.has(code)) {
          problems.push(`wrong path ${path.id} has ${code}, which is missing in expected_misconceptions`);
        }
        const missing = hintVariables(code).filter((name) => path.hint_vars?.[name] === undefined);
        if (missing.length > 0) problems.push(`wrong path ${path.id} lacks hint variables ${missing.join(", ")} for ${code}`);
      }
    }
  }

  const needsF7 = task.requires_answer_sentence || checksUnit;
  if (needsF7 !== expected.has("F7")) problems.push(needsF7 ? "F7 missing in expected_misconceptions" : "F7 listed but never checked");
  if (task.requires_sketch !== expected.has("F11")) {
    problems.push(task.requires_sketch ? "F11 missing in expected_misconceptions" : "F11 listed but no sketch required");
  }
  return problems;
}

/** Parses and checks task files. Throws on the first broken file, so broken content fails fast. */
export function loadTasks(files: Readonly<Record<string, unknown>>): Task[] {
  const tasks: Task[] = [];
  const ids = new Set<string>();
  for (const [file, data] of Object.entries(files)) {
    const parsed = taskFileSchema.safeParse(data);
    if (!parsed.success) throw new Error(`${file}: ${z.prettifyError(parsed.error)}`);
    for (const task of parsed.data) {
      if (file !== `L${task.lesson}.json`) throw new Error(`${file}: ${task.id} belongs to L${task.lesson}.json`);
      if (ids.has(task.id)) throw new Error(`${file}: duplicate task id ${task.id}`);
      const problems = checkTask(task);
      if (problems.length > 0) throw new Error(`${file}: ${task.id}: ${problems.join("; ")}`);
      ids.add(task.id);
      tasks.push(task);
    }
  }
  return tasks;
}

export const TASKS: readonly Task[] = loadTasks(TASK_FILES);

export function getTask(id: string): Task {
  const task = TASKS.find((t) => t.id === id);
  if (!task) throw new Error(`unknown task ${id}`);
  return task;
}

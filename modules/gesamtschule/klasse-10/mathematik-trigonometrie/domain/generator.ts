import { ANGLE_UNIT, acceptsValue, roundTo } from "./compare.ts";
import { createRng, drawOnGrid } from "./random.ts";
import { levelsOf, type Task } from "./schema.ts";
import { paramsValid, solve, type Params } from "./solutions.ts";
import { detectableCodes } from "./verify.ts";

/** Upper bound of draws per (seed, attempt) before giving up. */
export const MAX_DRAWS = 100;

/**
 * Draws the parameters of a task for one student seed and attempt. Draws that are degenerate or
 * ambiguous are rejected; the next draw uses a derived seed, so the result is deterministic.
 */
export function drawParameters(task: Task, seed: string, attempt: number): Params {
  const keys = Object.keys(task.parameters).sort();
  for (let draw = 0; draw < MAX_DRAWS; draw++) {
    const rng = createRng(`${task.id}|${seed}|${attempt}|${draw}`);
    const params: Params = {};
    for (const key of keys) {
      const range = task.parameters[key];
      if (range) params[key] = drawOnGrid(range, rng);
    }
    if (!isDegenerate(task, params) && !isAmbiguous(task, params)) return params;
  }
  throw new Error(`no unambiguous parameters for ${task.id} (seed ${seed}, attempt ${attempt}) after ${MAX_DRAWS} draws`);
}

/**
 * Degenerate: a parameter is not positive, an angle parameter is not below 90°, the task's own
 * validity check fails, or a sought value is not finite, not a positive length or not an angle
 * strictly between 0° and 90°.
 */
export function isDegenerate(task: Task, params: Params): boolean {
  for (const [key, range] of Object.entries(task.parameters)) {
    const value = params[key];
    if (value === undefined || !(value > 0)) return true;
    if (range.unit === ANGLE_UNIT && value >= 90) return true;
  }
  if (!paramsValid(task.solution_fn, params)) return true;

  for (const level of levelsOf(task)) {
    const solution = solve(task.solution_fn, params, level);
    if (solution.kind !== "numeric") continue;
    for (const quantity of task.levels[level]?.sought ?? []) {
      const value = solution.values[quantity];
      const unit = solution.units[quantity] ?? "";
      if (value === undefined || !Number.isFinite(value)) return true;
      if (unit === ANGLE_UNIT && !(value > 0 && value < 90)) return true;
      if (unit !== "" && unit !== ANGLE_UNIT && !(value > 0)) return true;
    }
  }
  return false;
}

/**
 * Ambiguous: on some level, the result of a wrong path of an expected misconception, in a form
 * a student would write it (see writtenForms), would be accepted as the correct value. Then
 * verify() could not tell the error from a right answer.
 * F5 is not checked here: it is detected through the intermediate values (umsetzungsplan 6.2).
 */
export function isAmbiguous(task: Task, params: Params): boolean {
  for (const level of levelsOf(task)) {
    const solution = solve(task.solution_fn, params, level);
    if (solution.kind !== "numeric") continue;
    for (const quantity of task.levels[level]?.sought ?? []) {
      const correct = solution.values[quantity];
      const unit = solution.units[quantity] ?? "";
      if (correct === undefined) continue;
      for (const path of solution.wrongPaths) {
        const wrong = path.values[quantity];
        if (wrong === undefined || detectableCodes(task, path).length === 0) continue;
        if (writtenForms(wrong, unit).some((w) => acceptsValue(w, correct, unit, task.tolerance))) return true;
      }
    }
  }
  return false;
}

/**
 * How a student may write a value: exact or rounded to 2 decimals; lengths also to 1 decimal,
 * angles also to 1 decimal and whole degrees. Ratios (unit "") are written with at least
 * 2 decimals in this module (value table, 0,5736), so 1 decimal is not considered for them.
 */
export function writtenForms(value: number, unit: string): number[] {
  const decimals = unit === ANGLE_UNIT ? [2, 1, 0] : unit === "" ? [2] : [2, 1];
  return [value, ...decimals.map((d) => roundTo(value, d))];
}

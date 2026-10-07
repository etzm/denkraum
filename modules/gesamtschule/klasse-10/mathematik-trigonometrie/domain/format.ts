import type { Niveau } from "@denkraum/core";
import { ANGLE_UNIT, decimalPlaces, roundTo } from "./compare.ts";
import type { Task } from "./schema.ts";
import { solve, type Params, type Values } from "./solutions.ts";
import { fillTemplate } from "./template.ts";

/**
 * Display rules (DECISIONS.md T-21, T-28): decimal comma, results rounded at the end.
 * Lengths and angles with 2 decimals, ratios (sin, cos, tan) with 4.
 */
export function formatNumber(value: number, decimals: number): string {
  const rounded = roundTo(value, decimals);
  return rounded.toFixed(decimals).replace("-", "−").replace(".", ",");
}

/** A given value as it is printed on the sheet: as few decimals as needed (4,5 and 8, not 8,0). */
export function formatGiven(value: number): string {
  return formatNumber(value, Math.min(decimalPlaces(value), 4));
}

/** A computed value: 4 decimals for ratios, 2 for everything else. */
export function formatValue(value: number, unit: string): string {
  return formatNumber(value, unit === "" ? 4 : 2);
}

/** A value as the learner will type it again on the confirm screen: 2 decimals, without trailing zeros. */
export function formatInput(value: number | null): string {
  if (value === null) return "";
  return formatGiven(roundTo(value, 2)).replace("−", "-");
}

/**
 * Reads a number typed by a learner: decimal comma or point, optional minus (also the typographic
 * one), blanks ignored. Returns null for empty or invalid input.
 */
export function parseDecimal(input: string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const text = input.trim().replace(/[\u2212\u2013]/g, "-").replace(/\s+/g, "").replace(",", ".");
  if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** Template variables for a task: given parameters and every value of the model solution, formatted for display. */
export function textVariables(task: Task, level: Niveau, params: Params): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) vars[key] = formatGiven(value);
  const solution = solve(task.solution_fn, params, level);
  if (solution.kind === "numeric") {
    for (const [key, value] of Object.entries(solution.values)) {
      if (!(key in vars)) vars[key] = formatValue(value, solution.units[key] ?? "");
    }
  }
  return vars;
}

/** Fills a task template (text, step, hint) with the learner's numbers. */
export function renderText(template: string, vars: Readonly<Record<string, string>>): string {
  return fillTemplate(template, vars);
}

/** Unit of a sought or computed value, "" for ratios. */
export function unitOf(task: Task, level: Niveau, params: Params, quantity: string): string {
  const solution = solve(task.solution_fn, params, level);
  return solution.kind === "numeric" ? (solution.units[quantity] ?? "") : "";
}

/** Model solution values of a numeric task. */
export function solutionValues(task: Task, level: Niveau, params: Params): Values {
  const solution = solve(task.solution_fn, params, level);
  if (solution.kind !== "numeric") throw new Error(`${task.id} has no numeric solution`);
  return solution.values;
}

/** Appends the unit: 35° without a blank, 4,59 cm with one. */
export function withUnit(text: string, unit: string): string {
  if (unit === "") return text;
  return unit === ANGLE_UNIT ? `${text}${unit}` : `${text} ${unit}`;
}

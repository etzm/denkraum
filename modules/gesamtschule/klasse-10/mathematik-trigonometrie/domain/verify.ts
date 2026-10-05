import type { Niveau } from "@denkraum/core";
import { ANGLE_UNIT, acceptsValue, isRoundingOf, nearlyEqual } from "./compare.ts";
import { MISCONCEPTIONS, MISCONCEPTION_CODES, type MisconceptionCode } from "./misconceptions.ts";
import type { Task, TranscribedTask } from "./schema.ts";
import {
  recompute,
  solve,
  type ChecklistStep,
  type NumericSolution,
  type Overrides,
  type Params,
  type WrongPath,
} from "./solutions.ts";

export const VERIFICATION_STATUSES = ["correct", "partially_correct", "incorrect", "not_found"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** One observation of the verification. `detail` is technical English for logs and the feedback engine. */
export interface Evidence {
  detail: string;
  code?: MisconceptionCode;
  quantity?: string;
  step?: string;
  wrong_path?: string;
  expected?: number;
  received?: number | null;
  hint_vars?: Record<string, string>;
}

export interface VerificationResult {
  status: VerificationStatus;
  /** Ordered F1 to F13. */
  matched_misconceptions: MisconceptionCode[];
  evidence: Evidence[];
}

type FinalAnswer = TranscribedTask["final_answers"][number];

interface Context {
  task: Task;
  params: Params;
  level: Niveau;
  t: TranscribedTask;
  codes: Set<MisconceptionCode>;
  evidence: Evidence[];
}

/** "ok": everything required is there and right; "partial": checklist incomplete; "wrong": a value is wrong or missing. */
type ContentResult = "ok" | "partial" | "wrong";

/**
 * Codes of a wrong path that are recognised by the final value and expected for the task.
 * Only these are matched here and guarded by the generator.
 */
export function detectableCodes(task: Task, path: WrongPath): MisconceptionCode[] {
  return path.codes.filter(
    (code) => MISCONCEPTIONS[code].detection === "final_value" && task.expected_misconceptions.includes(code),
  );
}

/**
 * Checks one task of a confirmed transcription against the model solution (spec A 6.1, step 4).
 * Code decides, never a language model.
 */
export function verify(task: Task, params: Params, level: Niveau, transcribed: TranscribedTask): VerificationResult {
  if (transcribed.task_id !== task.id) {
    throw new Error(`transcription belongs to ${transcribed.task_id}, not to ${task.id}`);
  }
  const sought = task.levels[level]?.sought;
  if (!sought) throw new Error(`${task.id} has no level ${level}`);
  if (!transcribed.found) {
    return { status: "not_found", matched_misconceptions: [], evidence: [{ detail: "task not found on the photos" }] };
  }

  const ctx: Context = { task, params, level, t: transcribed, codes: new Set(), evidence: [] };
  const solution = solve(task.solution_fn, params, level);
  const content =
    solution.kind === "checklist" ? checkSteps(ctx, solution.steps) : checkValues(ctx, solution, sought);
  const formOk = checkForm(ctx, solution.kind === "numeric" ? solution : null, sought);

  const status: VerificationStatus =
    content === "wrong" ? "incorrect" : content === "partial" || !formOk ? "partially_correct" : "correct";
  return {
    status,
    matched_misconceptions: MISCONCEPTION_CODES.filter((code) => ctx.codes.has(code)),
    evidence: ctx.evidence,
  };
}

// ---------------------------------------------------------------------------
// Numeric tasks

function checkValues(ctx: Context, solution: NumericSolution, sought: readonly string[]): ContentResult {
  let allCorrect = true;
  for (const quantity of sought) {
    if (!checkQuantity(ctx, solution, quantity, findAnswer(ctx.t, quantity, sought.length))) allCorrect = false;
  }
  return allCorrect ? "ok" : "wrong";
}

function checkQuantity(
  ctx: Context,
  solution: NumericSolution,
  quantity: string,
  answer: FinalAnswer | undefined,
): boolean {
  const { task } = ctx;
  const expected = valueOf(solution, quantity);
  const unit = solution.units[quantity] ?? "";
  const tolerance = task.tolerance;
  const expects = (code: MisconceptionCode) => task.expected_misconceptions.includes(code);
  const note = (e: Omit<Evidence, "quantity" | "expected">) =>
    ctx.evidence.push({ quantity, expected, ...e });
  const flag = (code: MisconceptionCode, e: Omit<Evidence, "quantity" | "expected" | "code">) => {
    ctx.codes.add(code);
    note({ code, ...e });
  };

  if (!answer || answer.value === null) {
    note({ received: null, detail: "no final answer for this quantity" });
    return false;
  }
  const received = answer.value;
  if (acceptsValue(received, expected, unit, tolerance)) {
    note({ received, detail: "final value within tolerance" });
    return true;
  }

  // 1. Typical wrong paths (F1, F2, F3, F4, F6, F8, F10, F12).
  let matched = false;
  for (const path of solution.wrongPaths) {
    const codes = detectableCodes(task, path);
    const target = path.values[quantity];
    if (codes.length === 0 || target === undefined || !acceptsValue(received, target, unit, tolerance)) continue;
    matched = true;
    for (const code of codes) {
      flag(code, { received, wrong_path: path.id, detail: `matches wrong path ${path.id} (${target})`, ...hintVars(path) });
    }
  }
  if (matched) return false;

  // 2. A negative length is a clear sign of RAD or GRAD mode, even without an exact match.
  if (expects("F1") && unit !== "" && unit !== ANGLE_UNIT && received < 0) {
    flag("F1", { received, detail: "negative length" });
    return false;
  }

  // 3. Early rounding, only through the transcribed intermediate values.
  if (expects("F5")) {
    const rounding = explainByEarlyRounding(ctx, solution, quantity, received);
    if (rounding) {
      flag("F5", {
        received,
        detail: `explained by rounded intermediate values ${JSON.stringify(rounding.overrides)} (recomputed ${rounding.target})`,
      });
      return false;
    }
  }

  // 4. Approach and intermediate values right, only the final value off.
  if (expects("F13") && intermediatesFit(ctx, solution)) {
    flag("F13", { received, detail: "intermediate values fit the model solution, final value out of tolerance" });
    return false;
  }

  note({ received, detail: "final value out of tolerance, no known error pattern matches" });
  return false;
}

/**
 * F5: some transcribed intermediate value is a rounded (or truncated) version of a roundable
 * intermediate value, and recomputing with it reproduces the student's final value.
 */
function explainByEarlyRounding(
  ctx: Context,
  solution: NumericSolution,
  quantity: string,
  received: number,
): { overrides: Overrides; target: number } | null {
  const rounded: [string, number][] = [];
  for (const key of solution.roundable) {
    const exact = valueOf(solution, key);
    for (const { value } of ctx.t.intermediate_values) {
      if (value === null || nearlyEqual(value, exact)) continue;
      if (isRoundingOf(value, exact)) rounded.push([key, value]);
    }
  }
  if (rounded.length === 0) return null;

  const unit = solution.units[quantity] ?? "";
  const attempts: Overrides[] = [Object.fromEntries(rounded), ...rounded.map(([key, value]) => ({ [key]: value }))];
  for (const overrides of attempts) {
    const target = recompute(ctx.task.solution_fn, ctx.params, ctx.level, overrides)[quantity];
    if (target !== undefined && acceptsValue(received, target, unit, ctx.task.tolerance)) return { overrides, target };
  }
  return null;
}

/**
 * F13 precondition: at least one transcribed intermediate value, each matches a given or computed
 * value of the model solution, and at least one matches a computed value. The free-text approach
 * is not parsed; the intermediate values are the evidence for it.
 */
function intermediatesFit(ctx: Context, solution: NumericSolution): boolean {
  const given = ctx.t.intermediate_values.flatMap(({ value }) => (value === null ? [] : [value]));
  if (given.length === 0) return false;
  const computed = Object.entries(solution.values).map(([key, value]) => ({ value, unit: solution.units[key] ?? "" }));
  const inputs = Object.entries(ctx.params).map(([key, value]) => ({ value, unit: ctx.task.parameters[key]?.unit ?? "" }));
  const fits = (value: number, refs: { value: number; unit: string }[]) =>
    refs.some((ref) => acceptsValue(value, ref.value, ref.unit, ctx.task.tolerance));
  return given.every((v) => fits(v, computed) || fits(v, inputs)) && given.some((v) => fits(v, computed));
}

// ---------------------------------------------------------------------------
// Checklist tasks (L7-A1)

function checkSteps(ctx: Context, steps: readonly ChecklistStep[]): ContentResult {
  const { t } = ctx;
  const text = normalizeMath([t.approach ?? "", t.raw_text, ...t.intermediate_values.map((v) => v.label)].join("\n"));
  let present = 0;
  for (const step of steps) {
    const found = step.patterns.some((group) => group.every((source) => new RegExp(source).test(text)));
    if (found) present++;
    ctx.evidence.push({ step: step.id, detail: found ? "step present" : "step missing" });
  }
  return present === steps.length ? "ok" : present > 0 ? "partial" : "wrong";
}

/** Normalises handwritten maths for pattern matching: no blanks, ² for ^2, α for alpha, / for : and ÷. */
export function normalizeMath(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ \t ]+/g, "")
    .replace(/\^2/g, "²")
    .replace(/alpha/g, "α")
    .replace(/[·×⋅]/g, "*")
    .replace(/[:÷]/g, "/")
    .replace(/\(α\)/g, "α");
}

// ---------------------------------------------------------------------------
// Form: unit, answer sentence, sketch (F7, F11)

function checkForm(ctx: Context, solution: NumericSolution | null, sought: readonly string[]): boolean {
  const { task, t } = ctx;
  let ok = true;
  const flag = (code: MisconceptionCode, evidence: Omit<Evidence, "code">) => {
    ctx.codes.add(code);
    ctx.evidence.push({ code, ...evidence });
    ok = false;
  };

  // Digital tasks (faded, quick_check) take numbers without units.
  if (task.type === "paper" && solution) {
    for (const quantity of sought) {
      const expectedUnit = solution.units[quantity] ?? "";
      const answer = findAnswer(t, quantity, sought.length);
      if (expectedUnit === "" || !answer || answer.value === null) continue;
      const unit = normalizeUnit(answer.unit);
      if (unit === "") flag("F7", { quantity, detail: "unit missing" });
      else if (unit !== expectedUnit) flag("F7", { quantity, detail: `unit ${answer.unit} instead of ${expectedUnit}` });
    }
  }
  if (task.requires_answer_sentence && !t.answer_sentence_present) flag("F7", { detail: "answer sentence missing" });
  if (task.requires_sketch && !t.sketch_present) flag("F11", { detail: "sketch missing" });
  else if (task.requires_sketch && t.sketch_labels_ok === "wrong") flag("F11", { detail: "sketch labels missing or wrong" });
  return ok;
}

const UNIT_ALIASES: Readonly<Record<string, string>> = {
  grad: "°",
  deg: "°",
  zentimeter: "cm",
  meter: "m",
};

function normalizeUnit(unit: string | null): string {
  const u = (unit ?? "").trim().toLowerCase();
  return UNIT_ALIASES[u] ?? u;
}

// ---------------------------------------------------------------------------
// Helpers

const GREEK: Readonly<Record<string, string>> = { "α": "alpha", "β": "beta", "γ": "gamma" };

/** "α" -> "alpha", "a₂" -> "a2", "sin 30°" -> "sin30". */
export function normalizeQuantity(name: string): string {
  return name
    .toLowerCase()
    .replace(/[αβγ]/g, (letter) => GREEK[letter] ?? letter)
    .replace(/[₀-₉]/g, (digit) => String(digit.charCodeAt(0) - 0x2080))
    .replace(/[\s_°]/g, "");
}

/** Final answer for a sought quantity: by name, or the only answer if exactly one quantity is sought. */
function findAnswer(t: TranscribedTask, quantity: string, soughtCount: number): FinalAnswer | undefined {
  const key = normalizeQuantity(quantity);
  const byName = t.final_answers.find((answer) => normalizeQuantity(answer.quantity) === key);
  if (byName) return byName;
  return soughtCount === 1 && t.final_answers.length === 1 ? t.final_answers[0] : undefined;
}

function valueOf(solution: NumericSolution, key: string): number {
  const value = solution.values[key];
  if (value === undefined) throw new Error(`solution has no value "${key}"`);
  return value;
}

function hintVars(path: WrongPath): Pick<Evidence, "hint_vars"> {
  return path.hint_vars ? { hint_vars: path.hint_vars } : {};
}

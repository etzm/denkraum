import type { Niveau } from "@denkraum/core";
import { acceptsValue } from "./compare.ts";
import { parseDecimal } from "./format.ts";
import { drawParameters } from "./generator.ts";
import { renderHint, type MisconceptionCode } from "./misconceptions.ts";
import { createRng, type Rng } from "./random.ts";
import type { Task, TranscribedTask } from "./schema.ts";
import { solve, type Params } from "./solutions.ts";
import { TASKS } from "./tasks.ts";
import { placeholders } from "./template.ts";
import { verify, type Evidence, type VerificationResult, type VerificationStatus } from "./verify.ts";

/**
 * Rules of the lesson flow (spec A 2, 5 and 7). Everything that unlocks or counts is decided
 * here, by code (DECISIONS.md D-006); nothing depends on a language model.
 */

/** A faded task counts as done after this many wrong attempts; it is then marked "mit Hilfe". */
export const FADED_HELP_AFTER = 3;
/** A lesson is passed with this many paper tasks right in the first or second attempt. */
export const PASS_TASKS = 3;
export const PASS_MAX_ATTEMPT = 2;
/** The full solution can be opened after this many failed attempts at a paper task. */
export const SOLUTION_AFTER_FAILED = 2;

export interface LessonTasks {
  worked: Task | undefined;
  faded: Task[];
  paper: Task[];
}

/** Tasks of a lesson by type, in file order. */
export function lessonTasks(lesson: number): LessonTasks {
  const of = TASKS.filter((t) => t.lesson === lesson && t.interleaving_of === null);
  return {
    worked: of.find((t) => t.type === "worked_example"),
    faded: of.filter((t) => t.type === "faded"),
    paper: of.filter((t) => t.type === "paper"),
  };
}

/** Lessons built so far as a full flow (A1: only lesson 4). */
export const OPEN_LESSONS: readonly number[] = [4];

// ---------------------------------------------------------------------------
// Faded tasks

export interface FadedState {
  solved: boolean;
  wrong: number;
  /** Solved, or given up after FADED_HELP_AFTER wrong attempts. */
  done: boolean;
  withHelp: boolean;
}

export function fadedState(checks: readonly { correct: boolean }[]): FadedState {
  const solved = checks.some((c) => c.correct);
  const wrong = checks.filter((c) => !c.correct).length;
  const withHelp = !solved && wrong >= FADED_HELP_AFTER;
  return { solved, wrong, done: solved || withHelp, withHelp };
}

/** The worksheet opens when every faded task of the lesson is done. */
export function worksheetUnlocked(states: readonly FadedState[]): { open: boolean; withHelp: boolean } {
  return { open: states.length > 0 && states.every((s) => s.done), withHelp: states.some((s) => s.withHelp) };
}

export type HiddenStep =
  | { index: number; kind: "choice"; options: string[]; correct: string }
  | { index: number; kind: "value"; quantity: string; before: string; after: string };

/** Fixed parameters of a faded task (its ranges have min = max; drawn like any task). */
export function fadedParams(task: Task): Params {
  return drawParameters(task, "faded", 0);
}

function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/**
 * The hidden steps of a faded task on a level: chosen steps with their options in a fixed
 * shuffled order, typed steps split around the sought value (`{{b}}`).
 */
export function hiddenSteps(task: Task, level: Niveau): HiddenStep[] {
  const def = task.levels[level];
  if (!def) throw new Error(`${task.id} has no level ${level}`);
  return (def.hidden_steps ?? []).map((index): HiddenStep => {
    const step = def.steps[index] ?? "";
    const choices = def.choices?.[String(index)];
    if (choices) {
      return { index, kind: "choice", correct: step, options: shuffled([step, ...choices], createRng(`${task.id}|${level}|${index}`)) };
    }
    const quantity = placeholders(step).find((name) => def.sought.includes(name));
    if (!quantity) throw new Error(`${task.id} ${level}: hidden step ${index} has no sought value`);
    const [before = "", after = ""] = step.split(new RegExp(`\\{\\{\\s*${quantity}\\s*\\}\\}`));
    return { index, kind: "value", quantity, before, after };
  });
}

export interface StepCheck {
  index: number;
  correct: boolean;
}

export interface FadedCheck {
  correct: boolean;
  steps: StepCheck[];
  /** Codes found by verify() on the typed value. */
  codes: MisconceptionCode[];
  /** One hint for the next attempt, null when everything is right. */
  hint: string | null;
}

/**
 * Checks one attempt at a faded task. Chosen steps are compared with the step text, the typed
 * value goes through verify(), so RAD mode or swapped sides give their catalog hint.
 * `wrongBefore` is the number of earlier wrong attempts; without a recognised error the task
 * hints are given in order.
 */
export function checkFaded(task: Task, level: Niveau, answers: Readonly<Record<string, string>>, wrongBefore: number): FadedCheck {
  const params = fadedParams(task);
  const steps: StepCheck[] = [];
  let codes: MisconceptionCode[] = [];
  let evidence: Evidence[] = [];
  for (const step of hiddenSteps(task, level)) {
    const answer = answers[String(step.index)] ?? "";
    if (step.kind === "choice") {
      steps.push({ index: step.index, correct: answer === step.correct });
      continue;
    }
    const value = parseDecimal(answer);
    const result = verify(task, params, level, typedTranscription(task.id, step.quantity, value));
    steps.push({ index: step.index, correct: result.status === "correct" });
    codes = result.matched_misconceptions;
    evidence = result.evidence;
  }
  const correct = steps.every((s) => s.correct);
  if (correct) return { correct, steps, codes: [], hint: null };
  const firstCode = codes[0];
  const hint = firstCode
    ? renderHint(firstCode, evidence.find((e) => e.code === firstCode)?.hint_vars ?? {})
    : (task.hints[Math.min(wrongBefore, task.hints.length - 1)] ?? "Prüfe jeden Schritt noch einmal.");
  return { correct, steps, codes, hint };
}

/** A typed answer on screen as a transcription: no sketch, no sentence, no unit (DECISIONS.md T-04). */
function typedTranscription(taskId: string, quantity: string, value: number | null): TranscribedTask {
  return {
    task_id: taskId,
    found: true,
    sketch_present: false,
    sketch_labels_ok: "unclear",
    approach: null,
    intermediate_values: [],
    final_answers: value === null ? [] : [{ quantity, value, unit: null }],
    answer_sentence_present: false,
    transcription_confidence: 1,
    raw_text: "",
  };
}

// ---------------------------------------------------------------------------
// Calculator check (spec A 3, lesson 3; repeated in lesson 4)

export type CalculatorMode = "deg" | "rad" | "grad" | "other";

/** What a typed value for sin 30° says about the calculator's angle mode. */
export function calculatorCheck(input: string): CalculatorMode | null {
  const value = parseDecimal(input);
  if (value === null) return null;
  const tolerance = { relative: 0.01, absolute_angle_deg: 0.5 };
  const solution = solve("L3-A2", {}, "M");
  if (solution.kind !== "numeric") return "other";
  if (acceptsValue(value, solution.values.sin30 ?? Number.NaN, "", tolerance)) return "deg";
  for (const path of solution.wrongPaths) {
    const target = path.values.sin30;
    if (target !== undefined && acceptsValue(value, target, "", tolerance)) return path.id === "rad_mode" ? "rad" : "grad";
  }
  return "other";
}

// ---------------------------------------------------------------------------
// Worksheets

const SHEET_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 4 characters without 0/O and 1/I (DECISIONS.md D-024). Not unique; the open sheet in the app does the matching (D-012). */
export function sheetCode(rng: Rng): string {
  return Array.from({ length: 4 }, () => SHEET_CODE_ALPHABET[Math.floor(rng() * SHEET_CODE_ALPHABET.length)]).join("");
}

export interface PriorResult {
  taskId: string;
  attemptNo: number;
  status: VerificationStatus;
  solutionViewed?: boolean;
}

export interface WorksheetPlan {
  taskIds: string[];
  params: Record<string, Params>;
  /** Attempt number per task: earlier results of that task plus one. */
  attempts: Record<string, number>;
  sheetCode: string;
}

/** Paper tasks still to do: all without a correct result. When all are correct, all again (practice). */
export function tasksForNextSheet(paper: readonly Task[], results: readonly PriorResult[]): Task[] {
  const open = paper.filter((t) => !results.some((r) => r.taskId === t.id && r.status === "correct"));
  return open.length > 0 ? open : [...paper];
}

/** Numbers for one learner, sheet and attempt; the seed is random per sheet, never derived from the learner. */
export function planWorksheet(tasks: readonly Task[], seed: string, results: readonly PriorResult[]): WorksheetPlan {
  const params: Record<string, Params> = {};
  const attempts: Record<string, number> = {};
  for (const task of tasks) {
    const attempt = results.filter((r) => r.taskId === task.id).length + 1;
    attempts[task.id] = attempt;
    params[task.id] = drawParameters(task, seed, attempt);
  }
  return { taskIds: tasks.map((t) => t.id), params, attempts, sheetCode: sheetCode(createRng(`sheet|${seed}`)) };
}

// ---------------------------------------------------------------------------
// Results

/** Failed attempts at one paper task: every result that is not correct. */
export function failedAttempts(results: readonly PriorResult[], taskId: string): number {
  return results.filter((r) => r.taskId === taskId && r.status !== "correct").length;
}

/** The full solution may be opened only after the second failed attempt (spec A 2.3). */
export function solutionAvailable(results: readonly PriorResult[], taskId: string): boolean {
  return failedAttempts(results, taskId) >= SOLUTION_AFTER_FAILED;
}

/** Lesson passed: at least 3 of the paper tasks correct in the first or second attempt (spec A 5.8). */
export function lessonPassed(paper: readonly Task[], results: readonly PriorResult[]): boolean {
  const passed = paper.filter((t) =>
    results.some((r) => r.taskId === t.id && r.status === "correct" && r.attemptNo <= PASS_MAX_ATTEMPT),
  );
  return passed.length >= PASS_TASKS;
}

export const NEXT_ACTIONS = ["retry_same_numbers", "retry_new_numbers", "next_task", "show_solution_available"] as const;
export type NextAction = (typeof NEXT_ACTIONS)[number];

/** Next step after a verified attempt, decided by code; the feedback text only phrases it. */
export function nextAction(status: VerificationStatus, failedSoFar: number): NextAction {
  if (status === "correct") return "next_task";
  return failedSoFar >= SOLUTION_AFTER_FAILED ? "show_solution_available" : "retry_new_numbers";
}

export type StatusLabel = "richtig" | "fast" | "nochmal";

/** Status shown to the learner (spec A 5.7). */
export function statusLabel(status: VerificationStatus): StatusLabel {
  return status === "correct" ? "richtig" : status === "partially_correct" ? "fast" : "nochmal";
}

/** Codes about the mathematics first, form (unit, sentence, sketch) last: the first one gets the hint. */
export function hintOrder(codes: readonly MisconceptionCode[]): MisconceptionCode[] {
  const form: MisconceptionCode[] = ["F7", "F11"];
  return [...codes.filter((c) => !form.includes(c)), ...codes.filter((c) => form.includes(c))];
}

/** Catalog hint for a verification result: used when the AI text is missing, refused or rejected (D-014). */
export function catalogHint(result: Pick<VerificationResult, "status" | "matched_misconceptions" | "evidence">): string {
  const code = hintOrder(result.matched_misconceptions)[0];
  if (code) return renderHint(code, result.evidence.find((e) => e.code === code)?.hint_vars ?? {});
  if (result.status === "correct") return "Weiter so: Skizze, Rechenweg und Antwortsatz passen.";
  if (result.status === "not_found") return "Diese Aufgabe war auf deinem Foto nicht zu finden. Schreib die Aufgabennummer gut lesbar an deine Lösung.";
  return "Geh deinen Rechenweg Schritt für Schritt durch: Skizze, Seiten benennen, Verhältnis wählen, umstellen, rechnen.";
}

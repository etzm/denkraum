import { z } from "zod";
import type { Niveau } from "@denkraum/core";
import { acceptsValue, roundTo } from "./compare.ts";
import { formatNumber, renderText, textVariables } from "./format.ts";
import { hintOrder, NEXT_ACTIONS, type NextAction } from "./lesson.ts";
import { MISCONCEPTIONS, MISCONCEPTION_CODES, renderHint, type MisconceptionCode } from "./misconceptions.ts";
import type { Task, TranscribedTask } from "./schema.ts";
import { solve, type Params } from "./solutions.ts";
import { getTask } from "./tasks.ts";
import { VERIFICATION_STATUSES, type VerificationResult } from "./verify.ts";

/**
 * What goes to the model and what comes back (spec A 6.2, 6.3, 6.5, 6.6). The inputs carry
 * task data only, never anything about the learner (docs/datenschutz/README.md section 3);
 * every output is checked against a schema with length limits before it is used.
 */

// ---------------------------------------------------------------------------
// Transcription (spec A 6.2)

export const PHOTO_QUALITY_ISSUES = ["blur", "dark", "cut_off", "glare"] as const;
export type PhotoQualityIssue = (typeof PHOTO_QUALITY_ISSUES)[number];

export const aiTranscribedTaskSchema = z.object({
  task_id: z.string().max(20),
  found: z.boolean(),
  sketch_present: z.boolean(),
  sketch_labels_ok: z.enum(["ok", "wrong", "unclear"]),
  approach: z.string().max(500).nullable(),
  intermediate_values: z.array(z.object({ label: z.string().max(80), value: z.number().nullable() })).max(20),
  final_answers: z
    .array(
      z.object({
        quantity: z.string().max(20),
        value: z.number().nullable(),
        unit: z.string().max(12).nullable(),
        /** Read, but not sure (prompt version 2, D-032). Unreadable values are null instead. */
        uncertain: z.boolean(),
      }),
    )
    .max(10),
  answer_sentence_present: z.boolean(),
  transcription_confidence: z.number().min(0).max(1),
  raw_text: z.string().max(3000),
});
export type AiTranscribedTask = z.infer<typeof aiTranscribedTaskSchema>;

export const aiTranscriptionSchema = z.object({
  sheet_id: z.string().max(20).nullable(),
  tasks: z.array(aiTranscribedTaskSchema).max(8),
  unreadable_regions: z.array(z.string().max(200)).max(20),
  photo_quality_issue: z.enum(PHOTO_QUALITY_ISSUES).nullable(),
});
export type AiTranscription = z.infer<typeof aiTranscriptionSchema>;

/** Below this confidence the confirm screen asks for a new photo (spec A 5.6). */
export const LOW_CONFIDENCE = 0.6;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A transcription as stored. Those from prompt version 1 have no `uncertain` flag; their
 * values read as certain. Returns null when the stored value is no transcription.
 */
export function parseStoredTranscription(value: unknown): AiTranscription | null {
  const upgraded =
    isRecord(value) && Array.isArray(value.tasks)
      ? {
          ...value,
          tasks: value.tasks.map((task: unknown) =>
            isRecord(task) && Array.isArray(task.final_answers)
              ? { ...task, final_answers: task.final_answers.map((a: unknown) => (isRecord(a) && !("uncertain" in a) ? { ...a, uncertain: false } : a)) }
              : task,
          ),
        }
      : value;
  const parsed = aiTranscriptionSchema.safeParse(upgraded);
  return parsed.success ? parsed.data : null;
}

/** "unreadable": the task was found, but this value could not be read. "uncertain": read, but please check. */
export type ReadingFlag = "unreadable" | "uncertain";

export interface ReadingCheck {
  /** Per sought quantity; quantities read with certainty are missing. */
  fields: Partial<Record<string, ReadingFlag>>;
  /** The task was found, but read with low confidence as a whole. */
  lowConfidence: boolean;
}

/**
 * Which fields the confirm screen marks for checking (D-032, module DECISIONS T-44): the model
 * marks what it is unsure about instead of guessing, the learner compares with the photo.
 * Nothing is marked for a task that was not found; the screen says so for the whole task.
 */
export function readingCheck(read: AiTranscribedTask | undefined, sought: readonly string[]): ReadingCheck {
  if (!read?.found) return { fields: {}, lowConfidence: false };
  const fields: Partial<Record<string, ReadingFlag>> = {};
  for (const quantity of sought) {
    const answer = read.final_answers.find((a) => a.quantity === quantity);
    if (!answer || answer.value === null) fields[quantity] = "unreadable";
    else if (answer.uncertain) fields[quantity] = "uncertain";
  }
  return { fields, lowConfidence: read.transcription_confidence < LOW_CONFIDENCE };
}

export interface SheetForAi {
  sheetCode: string;
  level: Niveau;
  taskIds: readonly string[];
  params: Readonly<Record<string, Params>>;
}

export interface TranscribeInput {
  sheet_code: string;
  niveau: Niveau;
  tasks: {
    task_id: string;
    number: number;
    text: string;
    given: Params;
    sought: { quantity: string; unit: string }[];
  }[];
}

/** Input of the transcription prompt: the task texts with the learner's numbers, no solutions. */
export function transcribeInput(sheet: SheetForAi): TranscribeInput {
  return {
    sheet_code: sheet.sheetCode,
    niveau: sheet.level,
    tasks: sheet.taskIds.map((id, i) => {
      const task = getTask(id);
      const params = sheet.params[id] ?? {};
      const def = task.levels[sheet.level];
      if (!def) throw new Error(`${id} has no level ${sheet.level}`);
      const solution = solve(task.solution_fn, params, sheet.level);
      const units = solution.kind === "numeric" ? solution.units : {};
      return {
        task_id: id,
        number: i + 1,
        text: renderText(def.text, textVariables(task, sheet.level, params)),
        given: params,
        sought: def.sought.map((quantity) => ({ quantity, unit: units[quantity] ?? "" })),
      };
    }),
  };
}

/** The transcription of one task of the sheet, matched by task id or by its number on the sheet. */
export function transcribedFor(transcription: AiTranscription | null, taskId: string, number: number): AiTranscribedTask | undefined {
  const tasks = transcription?.tasks ?? [];
  return (
    tasks.find((t) => t.task_id === taskId) ??
    tasks.find((t) => t.task_id.replace(/\D/g, "") === String(number) && !t.task_id.startsWith("L"))
  );
}

/** Whether the confirm screen should ask for a new photo (spec A 5.6). */
export function needsNewPhoto(transcription: AiTranscription | null): boolean {
  if (!transcription) return true;
  if (transcription.photo_quality_issue !== null) return true;
  const found = transcription.tasks.filter((t) => t.found);
  return found.length === 0 || found.some((t) => t.transcription_confidence < LOW_CONFIDENCE);
}

export interface ConfirmedFields {
  /** Typed values by quantity, as the learner left them in the form. */
  values: Readonly<Record<string, string>>;
  units: Readonly<Record<string, string>>;
  sketch: boolean;
  sentence: boolean;
}

/**
 * The confirmed transcription of one task: final values, units, sketch and answer sentence from
 * the form; approach, intermediate values and raw text stay as read (they feed F5 and F13).
 */
export function confirmTask(
  task: Task,
  level: Niveau,
  read: AiTranscribedTask | undefined,
  fields: ConfirmedFields,
  parse: (input: string) => number | null,
): TranscribedTask {
  const sought = task.levels[level]?.sought ?? [];
  const final_answers = sought.flatMap((quantity) => {
    const value = parse(fields.values[quantity] ?? "");
    const unit = (fields.units[quantity] ?? "").trim().slice(0, 12);
    return value === null ? [] : [{ quantity, value, unit: unit === "" ? null : unit }];
  });
  return {
    task_id: task.id,
    found: (read?.found ?? false) || final_answers.length > 0,
    sketch_present: fields.sketch,
    sketch_labels_ok: fields.sketch ? (read?.sketch_present ? read.sketch_labels_ok : "unclear") : "unclear",
    approach: read?.approach ?? null,
    intermediate_values: read?.intermediate_values ?? [],
    final_answers,
    answer_sentence_present: fields.sentence,
    transcription_confidence: read?.transcription_confidence ?? 1,
    raw_text: read?.raw_text ?? "",
  };
}

/** Share of confirm-screen fields the learner changed (stored as edit_distance_ratio). */
export function changedShare(task: Task, level: Niveau, read: AiTranscribedTask | undefined, confirmed: TranscribedTask): { changed: number; total: number } {
  let changed = 0;
  let total = 0;
  for (const quantity of task.levels[level]?.sought ?? []) {
    const before = read?.final_answers.find((a) => a.quantity === quantity);
    const after = confirmed.final_answers.find((a) => a.quantity === quantity);
    total += 2;
    if ((before?.value ?? null) !== (after?.value ?? null)) changed++;
    if ((before?.unit ?? null) !== (after?.unit ?? null)) changed++;
  }
  total += 2;
  if ((read?.sketch_present ?? false) !== confirmed.sketch_present) changed++;
  if ((read?.answer_sentence_present ?? false) !== confirmed.answer_sentence_present) changed++;
  return { changed, total };
}

// ---------------------------------------------------------------------------
// Feedback (spec A 6.3)

export const aiFeedbackSchema = z.object({
  task_id: z.string().max(20),
  status: z.enum(VERIFICATION_STATUSES),
  headline: z.string().min(1).max(120),
  hint: z.string().min(1).max(400),
  misconception_codes: z.array(z.enum(MISCONCEPTION_CODES)).max(13),
  praise: z.string().max(300).nullable(),
  next_action: z.enum(NEXT_ACTIONS),
});
export type AiFeedback = z.infer<typeof aiFeedbackSchema>;

export interface FeedbackInput {
  task: { task_id: string; text: string; niveau: Niveau; requires_sketch: boolean; requires_answer_sentence: boolean };
  model_solution: { steps: string[]; values: Record<string, string> };
  transcription: TranscribedTask;
  verification: {
    status: VerificationResult["status"];
    misconception_codes: MisconceptionCode[];
    evidence: { detail: string; code?: string; quantity?: string }[];
  };
  catalog: { code: MisconceptionCode; label: string; hint: string }[];
  next_action: NextAction;
}

/**
 * Input of the feedback prompt (spec A 2.4): task, verified model solution, confirmed
 * transcription, the verification result and the catalog entries of the codes found.
 */
export function feedbackInput(
  task: Task,
  level: Niveau,
  params: Params,
  transcription: TranscribedTask,
  result: VerificationResult,
  next: NextAction,
): FeedbackInput {
  const def = task.levels[level];
  if (!def) throw new Error(`${task.id} has no level ${level}`);
  const vars = textVariables(task, level, params);
  const codes = hintOrder(result.matched_misconceptions);
  return {
    task: {
      task_id: task.id,
      text: renderText(def.text, vars),
      niveau: level,
      requires_sketch: task.requires_sketch,
      requires_answer_sentence: task.requires_answer_sentence,
    },
    model_solution: { steps: def.steps.map((s) => renderText(s, vars)), values: vars },
    transcription,
    verification: {
      status: result.status,
      misconception_codes: codes,
      evidence: result.evidence.map(({ detail, code, quantity }) => ({ detail, ...(code ? { code } : {}), ...(quantity ? { quantity } : {}) })),
    },
    catalog: codes.map((code) => ({
      code,
      label: MISCONCEPTIONS[code].label,
      hint: renderHint(code, result.evidence.find((e) => e.code === code)?.hint_vars ?? {}),
    })),
    next_action: next,
  };
}

/** Ways a value may appear in a text: 1 and 2 decimals, with comma or point. */
function writtenVariants(value: number): string[] {
  const variants = new Set<string>();
  for (const decimals of [1, 2]) {
    const plain = roundTo(Math.abs(value), decimals).toFixed(decimals);
    variants.add(plain);
    variants.add(plain.replace(".", ","));
  }
  return [...variants];
}

/**
 * True if the feedback text gives away a final result the learner has not got right yet
 * (spec A 2.3). Then the module shows the catalog hint instead (code decides, D-006).
 */
export function revealsResult(feedback: Pick<AiFeedback, "headline" | "hint" | "praise">, task: Task, level: Niveau, params: Params, transcription: TranscribedTask): boolean {
  const solution = solve(task.solution_fn, params, level);
  if (solution.kind !== "numeric") return false;
  const text = [feedback.headline, feedback.hint, feedback.praise ?? ""].join(" ");
  for (const quantity of task.levels[level]?.sought ?? []) {
    const expected = solution.values[quantity];
    if (expected === undefined) continue;
    const unit = solution.units[quantity] ?? "";
    const given = transcription.final_answers.find((a) => a.quantity === quantity)?.value ?? null;
    if (given !== null && acceptsValue(given, expected, unit, task.tolerance)) continue;
    for (const variant of writtenVariants(expected)) {
      if (new RegExp(`(^|[^0-9.,])${variant.replace(/[.]/g, "\\.")}($|[^0-9])`).test(text)) return true;
    }
  }
  return false;
}

/**
 * The AI text as stored: status, codes and next step are overwritten with what the code decided,
 * so the model can only phrase, never decide.
 */
export function enforceDecisions(feedback: AiFeedback, task: Task, result: VerificationResult, next: NextAction): AiFeedback {
  return { ...feedback, task_id: task.id, status: result.status, misconception_codes: hintOrder(result.matched_misconceptions), next_action: next };
}

// ---------------------------------------------------------------------------
// Mock answers (LLM_PROVIDER=mock): deterministic, derived from the request

/** The JSON input of a request; the platform may append a retry note after it. */
export function parseRequestInput(userText: string): unknown {
  const end = userText.indexOf("\n\nDeine vorige Antwort");
  return JSON.parse(end >= 0 ? userText.slice(0, end) : userText);
}

/**
 * Reads every task correctly: the right values with units, sketch and answer sentence present.
 * The last value of the last task is marked as uncertain, so the confirm screen shows a marked
 * field in development and in the end-to-end tests (D-032).
 */
export function mockTranscription(input: TranscribeInput): AiTranscription {
  return {
    sheet_id: input.sheet_code,
    tasks: input.tasks.map((t, ti) => {
      const task = getTask(t.task_id);
      const solution = solve(task.solution_fn, t.given, input.niveau);
      const values = solution.kind === "numeric" ? solution.values : {};
      return {
        task_id: t.task_id,
        found: true,
        sketch_present: true,
        sketch_labels_ok: "ok" as const,
        approach: null,
        intermediate_values: [],
        final_answers: t.sought.map(({ quantity, unit }, qi) => ({
          quantity,
          value: roundTo(values[quantity] ?? 0, 2),
          unit: unit === "" ? null : unit,
          uncertain: ti === input.tasks.length - 1 && qi === t.sought.length - 1,
        })),
        answer_sentence_present: true,
        transcription_confidence: 0.95,
        raw_text: `Aufgabe ${t.number}: ${t.sought.map(({ quantity }) => `${quantity} = ${formatNumber(values[quantity] ?? 0, 2)}`).join(", ")}`,
      };
    }),
    unreadable_regions: [],
    photo_quality_issue: null,
  };
}

const MOCK_HEADLINES: Record<VerificationResult["status"], string> = {
  correct: "Richtig gelöst!",
  partially_correct: "Fast! Deine Rechnung stimmt.",
  incorrect: "Noch nicht richtig.",
  not_found: "Diese Aufgabe habe ich nicht gefunden.",
};

/** Phrases the verification result with the catalog texts; never contains a number of the solution. */
export function mockFeedback(input: FeedbackInput): AiFeedback {
  const first = input.catalog[0];
  const correct = input.verification.status === "correct";
  return {
    task_id: input.task.task_id,
    status: input.verification.status,
    headline: MOCK_HEADLINES[input.verification.status],
    hint: first ? first.hint : correct ? "Weiter so: Skizze, Rechenweg und Antwortsatz passen." : "Geh deinen Rechenweg Schritt für Schritt durch.",
    misconception_codes: input.verification.misconception_codes,
    praise: input.transcription.sketch_present ? "Du hast eine Skizze gezeichnet." : null,
    next_action: input.next_action,
  };
}

import { z } from "zod";
import { NIVEAUS, type Niveau } from "@denkraum/core";
import { MISCONCEPTION_CODES } from "./misconceptions.ts";
import { placeholders } from "./template.ts";

export const TASK_TYPES = ["worked_example", "faded", "quick_check", "paper"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

/**
 * The only Bildungsplan codes a task may carry. All verified on bildungsplaene-bw.de
 * (docs/umsetzungsplan.md, section 6.5). Do not add codes without checking them there.
 */
export const BILDUNGSPLAN_CODES = [
  "BP2016BW_ALLG_SEK1_M_IK_7-8-9_03(16)",
  "BP2016BW_ALLG_SEK1_M_IK_7-8-9_03(17)",
  "BP2016BW_ALLG_SEK1_M_IK_7-8-9_03(18)",
  "BP2016BW_ALLG_SEK1_M_IK_7-8-9_03(21)",
  "BP2016BW_ALLG_SEK1_M_IK_10_03(1)",
  "BP2016BW_ALLG_SEK1_M_IK_10_03(2)",
] as const;
export type BildungsplanCode = (typeof BILDUNGSPLAN_CODES)[number];

/** Levels on which each code exists in the Bildungsplan. */
export const BILDUNGSPLAN_LEVELS: Readonly<Record<BildungsplanCode, readonly Niveau[]>> = {
  "BP2016BW_ALLG_SEK1_M_IK_7-8-9_03(16)": ["G", "M", "E"],
  // Ähnlichkeitssätze: no G level.
  "BP2016BW_ALLG_SEK1_M_IK_7-8-9_03(17)": ["M", "E"],
  "BP2016BW_ALLG_SEK1_M_IK_7-8-9_03(18)": ["G", "M", "E"],
  "BP2016BW_ALLG_SEK1_M_IK_7-8-9_03(21)": ["G", "M", "E"],
  // On G only sine and tangent, see SIN_TAN_ONLY_ON_G.
  "BP2016BW_ALLG_SEK1_M_IK_10_03(1)": ["G", "M", "E"],
  // sin² + cos² = 1 and related identities: E only.
  "BP2016BW_ALLG_SEK1_M_IK_10_03(2)": ["E"],
};

/** On level G, 10_03(1) covers sine and tangent only, so G material must not use the cosine. */
export const SIN_TAN_ONLY_ON_G: BildungsplanCode = "BP2016BW_ALLG_SEK1_M_IK_10_03(1)";
const COSINE = /cos|kosinus/i;

const bildungsplanCodeSchema = z.enum(BILDUNGSPLAN_CODES);

export const parameterRangeSchema = z
  .strictObject({
    min: z.number(),
    max: z.number(),
    step: z.number().positive(),
    unit: z.string(),
  })
  .refine((r) => r.min <= r.max, { message: "min must not exceed max" })
  .refine((r) => {
    const steps = (r.max - r.min) / r.step;
    return Math.abs(steps - Math.round(steps)) < 1e-9;
  }, { message: "max - min must be a whole number of steps" });
export type ParameterRange = z.infer<typeof parameterRangeSchema>;

export const toleranceSchema = z.strictObject({
  relative: z.number().positive().max(0.1),
  absolute_angle_deg: z.number().positive().max(5),
});
export type Tolerance = z.infer<typeof toleranceSchema>;

export const levelSchema = z
  .strictObject({
    /** Task text; `{{name}}` refers to a parameter or a solution value. */
    text: z.string().min(1),
    /** Keys of the solution values the student has to find. Empty for checklist tasks. */
    sought: z.array(z.string().min(1)),
    /** Solution steps, shown in the worked solution and in faded tasks. */
    steps: z.array(z.string().min(1)),
    /** Faded tasks: indices into `steps` that are hidden on this level. */
    hidden_steps: z.array(z.number().int().nonnegative()).optional(),
    /**
     * Faded tasks: wrong alternatives for a hidden step that is chosen, not typed, keyed by the
     * step index. The step text itself is the right option. A hidden step without choices must
     * contain exactly one sought value (`{{b}}`); the learner types that value.
     */
    choices: z.record(z.string().regex(/^\d+$/), z.array(z.string().min(1)).min(1).max(4)).optional(),
    extra: z.string().min(1).optional(),
    /** Codes that apply on this level in addition to the task's codes. */
    bildungsplan: z.array(bildungsplanCodeSchema).optional(),
  })
  .refine((l) => (l.hidden_steps ?? []).every((i) => i < l.steps.length), {
    message: "hidden_steps index out of range",
    path: ["hidden_steps"],
  })
  .refine((l) => Object.keys(l.choices ?? {}).every((key) => (l.hidden_steps ?? []).includes(Number(key))), {
    message: "choices are only allowed for hidden steps",
    path: ["choices"],
  });
export type Level = z.infer<typeof levelSchema>;

export const taskSchema = z
  .strictObject({
    id: z.string().regex(/^L[1-7]-A\d+$/),
    lesson: z.number().int().min(1).max(7),
    type: z.enum(TASK_TYPES),
    bildungsplan: z.array(bildungsplanCodeSchema).min(1),
    levels: z.strictObject({
      G: levelSchema.optional(),
      M: levelSchema.optional(),
      E: levelSchema.optional(),
    }),
    parameters: z.record(z.string().regex(/^[a-z][a-z0-9_]*$/), parameterRangeSchema),
    solution_fn: z.string().min(1),
    requires_sketch: z.boolean(),
    requires_answer_sentence: z.boolean(),
    tolerance: toleranceSchema,
    /** Every code verify.ts may report for this task. Wrong paths of these codes are guarded by the generator. */
    expected_misconceptions: z.array(z.enum(MISCONCEPTION_CODES)),
    hints: z.array(z.string().min(1)),
    interleaving_of: z.string().nullable(),
  })
  .superRefine((task, ctx) => {
    const issue = (message: string, path: PropertyKey[]) => ctx.addIssue({ code: "custom", message, path });

    if (!task.id.startsWith(`L${task.lesson}-`)) issue(`id must start with L${task.lesson}-`, ["id"]);
    if (task.type !== "paper" && (task.requires_sketch || task.requires_answer_sentence)) {
      issue("only paper tasks can require a sketch or an answer sentence", ["type"]);
    }
    for (const level of levelsOf(task)) {
      const def = task.levels[level];
      if (!def) continue;
      if (task.type !== "faded" && (def.hidden_steps !== undefined || def.choices !== undefined)) {
        issue("only faded tasks hide steps", ["levels", level]);
      }
      if (task.type === "faded" && (def.hidden_steps ?? []).length === 0) {
        issue("a faded task hides at least one step", ["levels", level, "hidden_steps"]);
      }
      for (const index of def.hidden_steps ?? []) {
        const typed = placeholders(def.steps[index] ?? "").filter((name) => def.sought.includes(name));
        const chosen = def.choices?.[String(index)] !== undefined;
        if (chosen === (new Set(typed).size === 1)) {
          issue(`hidden step ${index} needs either choices or exactly one sought value`, ["levels", level, "hidden_steps"]);
        }
      }
    }

    const levels = levelsOf(task);
    if (levels.length === 0) issue("at least one level is required", ["levels"]);
    for (const level of levels) {
      const codes = bildungsplanFor(task, level);
      for (const code of codes) {
        if (!BILDUNGSPLAN_LEVELS[code].includes(level)) {
          issue(`${code} does not exist on level ${level}`, ["levels", level, "bildungsplan"]);
        }
      }
      const def = task.levels[level];
      if (level === "G" && def && codes.includes(SIN_TAN_ONLY_ON_G)) {
        const texts = [def.text, ...def.steps, def.extra ?? "", ...Object.values(def.choices ?? {}).flat(), ...task.hints];
        if (texts.some((t) => COSINE.test(t))) {
          issue(`${SIN_TAN_ONLY_ON_G} on level G covers sine and tangent only, no cosine`, ["levels", "G"]);
        }
      }
    }
  });
export type Task = z.infer<typeof taskSchema>;

export const taskFileSchema = z.array(taskSchema).min(1);

/** Levels a task exists on, in the order G, M, E. */
export function levelsOf(task: Pick<Task, "levels">): Niveau[] {
  return NIVEAUS.filter((level) => task.levels[level] !== undefined);
}

/** Bildungsplan codes of a task on one level: the task's codes plus the level's additions. */
export function bildungsplanFor(task: Pick<Task, "bildungsplan" | "levels">, level: Niveau): BildungsplanCode[] {
  return [...new Set([...task.bildungsplan, ...(task.levels[level]?.bildungsplan ?? [])])];
}

/**
 * One task of the confirmed transcription (spec A 6.2). This is the input of verify():
 * the student has already confirmed or corrected it.
 */
export const transcribedTaskSchema = z.object({
  task_id: z.string(),
  found: z.boolean(),
  sketch_present: z.boolean(),
  sketch_labels_ok: z.enum(["ok", "wrong", "unclear"]),
  approach: z.string().nullable(),
  intermediate_values: z.array(z.object({ label: z.string(), value: z.number().nullable() })),
  final_answers: z.array(
    z.object({ quantity: z.string(), value: z.number().nullable(), unit: z.string().nullable() }),
  ),
  answer_sentence_present: z.boolean(),
  transcription_confidence: z.number().min(0).max(1),
  raw_text: z.string(),
});
export type TranscribedTask = z.infer<typeof transcribedTaskSchema>;

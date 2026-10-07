import { z } from "zod";
import { ladderStufeSchema, niveauSchema } from "./common.ts";

// Micro exercises (spec 5). Deterministic, scored by `scoreExercise` in domain/exercises.ts.

export const EXERCISE_TYPES = [
  "sort_paragraphs",
  "pick_thesis",
  "fill_connector",
  "rank_arguments",
  "complete_bbb",
  "sentence_upgrade",
  "mark_parts",
] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export const BBB_PARTS = ["behauptung", "begruendung", "beispiel"] as const;
export const MARKABLE_PARTS = ["these", "behauptung", "begruendung", "beispiel"] as const;

/** Placeholder for a gap in fill_connector texts. */
export const GAP = "___";

const line = z.string().min(1).max(600);
const options = z.array(line).min(2).max(4);

function isPermutation(order: readonly number[], length: number): boolean {
  return order.length === length && [...order].sort((a, b) => a - b).every((v, i) => v === i);
}

const choice = z
  .object({ options, correct: z.number().int().min(0) })
  .refine((p) => p.correct < p.options.length, { message: "correct out of range", path: ["correct"] });

const base = {
  id: z.string().regex(/^ex-\d{4}$/),
  stufe: ladderStufeSchema,
  niveau: niveauSchema,
  /** Instruction for the student, Du-Form. */
  prompt: z.string().min(1).max(200),
  /** Shown after a wrong answer. */
  explanation: z.string().min(1).max(400),
  tags: z.array(z.string().regex(/^[a-z0-9_]+$/)).max(8),
  /** Set by hand after review by the German teacher (spec 10.4). */
  approved: z.boolean(),
};

export const exerciseSchema = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("sort_paragraphs"),
    payload: z
      .object({
        /** In the order shown to the student. */
        paragraphs: z.array(line).min(3).max(6),
        /** Indices into `paragraphs`, in the correct reading order. */
        correct_order: z.array(z.number().int().min(0)),
      })
      .refine((p) => isPermutation(p.correct_order, p.paragraphs.length), {
        message: "correct_order must be a permutation",
        path: ["correct_order"],
      }),
  }),
  z.object({
    ...base,
    type: z.literal("pick_thesis"),
    payload: z
      .object({ arguments: z.array(line).length(3), options, correct: z.number().int().min(0) })
      .refine((p) => p.correct < p.options.length, { message: "correct out of range", path: ["correct"] }),
  }),
  z.object({
    ...base,
    type: z.literal("fill_connector"),
    payload: z
      .object({
        /** Text with one `___` per gap. */
        text: line,
        gaps: z.array(choice).min(1).max(3),
      })
      .refine((p) => p.text.split(GAP).length - 1 === p.gaps.length, {
        message: "number of gaps must match the text",
        path: ["gaps"],
      }),
  }),
  z.object({
    ...base,
    type: z.literal("rank_arguments"),
    payload: z
      .object({
        thesis: line,
        arguments: z.array(line).min(3).max(4),
        /** Indices into `arguments`, from the weakest to the strongest (spec 2.2). */
        correct_order: z.array(z.number().int().min(0)),
      })
      .refine((p) => isPermutation(p.correct_order, p.arguments.length), {
        message: "correct_order must be a permutation",
        path: ["correct_order"],
      }),
  }),
  z.object({
    ...base,
    type: z.literal("complete_bbb"),
    payload: z.object({
      /** An argument with one of the three parts missing. */
      argument: line,
      correct: z.enum(BBB_PARTS),
    }),
  }),
  z.object({
    ...base,
    type: z.literal("sentence_upgrade"),
    payload: z
      .object({ sentence: line, options, correct: z.number().int().min(0) })
      .refine((p) => p.correct < p.options.length, { message: "correct out of range", path: ["correct"] }),
  }),
  z.object({
    ...base,
    type: z.literal("mark_parts"),
    payload: z
      .object({
        /** The sample text, split into markable spans. */
        segments: z.array(line).min(2).max(15),
        /** The part the student marks in this task. */
        target: z.enum(MARKABLE_PARTS),
        /** Indices of all segments that are this part. */
        correct: z.array(z.number().int().min(0)).min(1),
      })
      .refine(
        (p) => new Set(p.correct).size === p.correct.length && p.correct.every((i) => i < p.segments.length),
        { message: "correct must be unique segment indices", path: ["correct"] },
      ),
  }),
]);

export type Exercise = z.infer<typeof exerciseSchema>;

export const exerciseFileSchema = z.array(exerciseSchema);

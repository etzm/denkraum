import { z } from "zod";
import { checkWordLimit, starSchema } from "./common.ts";

// Output of P4 text_review (spec 7.4). Field names follow the spec.

/** All fields the model writes for the student, together (prompt P4). Quotes are the student's own words and do not count. */
export const TEXT_REVIEW_MAX_WORDS = 140;

const quote = z.string().max(2000);

export const textReviewSchema = z
  .object({
    lens: z.object({
      /** Exact quote or "" when missing. */
      these: quote,
      argumente: z
        .array(z.object({ behauptung: quote, begruendung: quote, beispiel: quote }))
        .max(5),
      gegenargument: z.object({ einwand: quote, entkraeftung: quote }).optional(),
    }),
    /** Formative only. `richtigkeit` is not used for display; D comes in through `computeStars` (DECISIONS.md, SW-06). */
    scores: z.object({
      aufbau: starSchema,
      argumentation: starSchema,
      sprache: starSchema,
      richtigkeit: starSchema,
    }),
    e_bonus: z
      .object({
        gegenargument_genannt: z.boolean(),
        gegenargument_entkraeftet: z.boolean(),
        schlussregel: z.boolean(),
      })
      .optional(),
    /** Errors per 100 words. Interim source for dimension D until LanguageTool counts it. */
    error_density: z.number().min(0).max(100),
    strengths: z.array(z.object({ text: z.string().min(1).max(300), quote })).max(2),
    next_step: z.string().max(300),
    revision_task: z.object({
      instruction: z.string().max(400),
      target_quote: quote,
      help_card_id: z.union([z.string().regex(/^HK-\d{2}$/), z.literal("")]),
    }),
    /** "" when the self check matches the review. */
    self_check_note: z.string().max(300),
    flags: z.object({
      too_short: z.boolean(),
      off_topic: z.boolean(),
      inappropriate: z.boolean(),
    }),
  })
  .superRefine((review, ctx) => {
    if (!isFlagged(review)) {
      // A regular review: two strengths and a complete revision task.
      if (review.strengths.length !== 2) {
        ctx.addIssue({ code: "custom", path: ["strengths"], message: "exactly two strengths expected" });
      }
      if (review.next_step.trim() === "") {
        ctx.addIssue({ code: "custom", path: ["next_step"], message: "next step missing" });
      }
      const task = review.revision_task;
      if (task.instruction.trim() === "" || task.target_quote.trim() === "" || task.help_card_id === "") {
        ctx.addIssue({ code: "custom", path: ["revision_task"], message: "revision task incomplete" });
      }
    }
    checkWordLimit(
      ctx,
      [
        ...review.strengths.map((s) => s.text),
        review.next_step,
        review.revision_task.instruction,
        review.self_check_note,
      ],
      TEXT_REVIEW_MAX_WORDS,
      ["next_step"],
    );
  });

export type TextReview = z.infer<typeof textReviewSchema>;

/** A flagged review replaces the assessment with one sentence; strengths and quotes may then be empty. */
export function isFlagged(review: Pick<TextReview, "flags">): boolean {
  return review.flags.too_short || review.flags.off_topic || review.flags.inappropriate;
}

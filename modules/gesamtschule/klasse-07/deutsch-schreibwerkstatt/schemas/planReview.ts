import { z } from "zod";
import { ampelSchema, checkWordLimit } from "./common.ts";

// Output of P2 plan_review (spec 7.4).

export const PLAN_REVIEW_MIRROR_PREFIX = "So habe ich deinen Plan verstanden:";
/** Mirror and question together (prompt P2). */
export const PLAN_REVIEW_MAX_WORDS = 80;

export const planReviewSchema = z
  .object({
    mirror: z.string().min(1).max(600),
    criteria: z.object({
      P1: ampelSchema,
      P2: ampelSchema,
      P3: ampelSchema,
      P4: ampelSchema,
      P5: ampelSchema,
    }),
    question: z.string().min(1).max(300),
    /** Advisory only. The gate to writing is the code check `planGate` (DECISIONS.md, SW-04). */
    approved: z.boolean(),
    /** Short keywords shown in plan_revise. */
    missing: z.array(z.string().max(80)).max(5),
  })
  .superRefine((review, ctx) => {
    if (!review.mirror.trimStart().startsWith(PLAN_REVIEW_MIRROR_PREFIX)) {
      ctx.addIssue({ code: "custom", path: ["mirror"], message: "mirror must start with the fixed prefix" });
    }
    checkWordLimit(ctx, [review.mirror, review.question], PLAN_REVIEW_MAX_WORDS, ["question"]);
  });

export type PlanReview = z.infer<typeof planReviewSchema>;

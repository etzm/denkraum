import { z } from "zod";
import { checkWordLimit } from "./common.ts";

// Output of P5 revision_check (spec 7.4).

export const REVISION_FEEDBACK_MAX_WORDS = 25;

export const revisionCheckSchema = z
  .object({
    /** Formative. Decides only whether a second attempt is offered, never blocks completion. */
    fulfilled: z.boolean(),
    feedback: z.string().min(1).max(250),
  })
  .superRefine((check, ctx) => {
    checkWordLimit(ctx, [check.feedback], REVISION_FEEDBACK_MAX_WORDS, ["feedback"]);
  });

export type RevisionCheck = z.infer<typeof revisionCheckSchema>;

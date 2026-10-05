import { z } from "zod";

// Student input in state self_check (spec 4): ticked checklist items and marked passages.

export const selfCheckSchema = z.object({
  checkedItemIds: z.array(z.string().max(40)).max(20),
  marks: z
    .array(
      z.object({
        part: z.enum(["these", "beispiel"]),
        /** Exact passage of the confirmed text. */
        quote: z.string().min(1).max(2000),
      }),
    )
    .max(20),
});

export type SelfCheck = z.infer<typeof selfCheckSchema>;

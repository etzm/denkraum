import { z } from "zod";
import { legibilitySchema } from "./common.ts";

// Output of P1 plan_transcribe (spec 7.4). Field names follow the spec.

const box = z.string().max(1000);

export const planArgumentSchema = z.object({
  behauptung: box,
  begruendung: box,
  beispiel: box,
});

export const counterArgumentSchema = z.object({
  einwand: box,
  entkraeftung: box,
});

export const planTranscriptSchema = z.object({
  thema: box,
  standpunkt: box,
  /** Always three boxes; empty boxes are empty strings. The paragraph template uses only the first. */
  argumente: z.array(planArgumentSchema).length(3),
  reihenfolge: box,
  schluss: box,
  gegenargument: counterArgumentSchema.optional(),
  legibility: legibilitySchema,
  uncertain: z.array(z.string().max(200)).max(50),
});

export type PlanTranscript = z.infer<typeof planTranscriptSchema>;

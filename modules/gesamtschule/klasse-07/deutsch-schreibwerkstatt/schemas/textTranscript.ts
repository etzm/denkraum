import { z } from "zod";
import { legibilitySchema } from "./common.ts";

// Output of P3 text_transcribe (spec 7.4).

export const textTranscriptSchema = z.object({
  paragraphs: z.array(z.string().max(4000)).max(30),
  /** Reported by the model; the code recounts on the confirmed text (`countWords`). */
  word_count: z.number().int().min(0),
  legibility: legibilitySchema,
  uncertain: z.array(z.string().max(200)).max(50),
});

export type TextTranscript = z.infer<typeof textTranscriptSchema>;

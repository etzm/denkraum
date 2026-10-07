import { LLM_TIERS } from "@denkraum/core";
import { z } from "zod";
import { OUTPUT_SCHEMA_NAMES } from "./output.ts";

/** Frontmatter of prompts/<name>.v<N>.md (spec 7.3, DECISIONS D-005). */
export const promptFrontmatterSchema = z.strictObject({
  name: z.string().regex(/^[a-z][a-z0-9_]*$/),
  version: z.number().int().min(1),
  model_tier: z.enum(LLM_TIERS),
  output_schema: z.enum(OUTPUT_SCHEMA_NAMES),
});

export type PromptFrontmatter = z.infer<typeof promptFrontmatterSchema>;

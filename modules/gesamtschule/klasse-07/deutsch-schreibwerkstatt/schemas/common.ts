import { z } from "zod";
import { countWords } from "../domain/text.ts";

/** Traffic light of the plan criteria (spec 7.2). ASCII values on purpose, they are enum values. */
export const ampelSchema = z.enum(["gruen", "gelb", "rot"]);
export type Ampel = z.infer<typeof ampelSchema>;

/** 0 to 3 stars per rubric dimension (spec 7.1). */
export const starSchema = z.literal([0, 1, 2, 3]);
export type Star = z.infer<typeof starSchema>;

/** Stages 1 to 6 of the skill ladder plus the boss mission (spec 2.3). */
export const stufeSchema = z.literal([1, 2, 3, 4, 5, 6, "boss"]);
export type Stufe = z.infer<typeof stufeSchema>;

/** Stages that have exercises and help cards (no boss). */
export const ladderStufeSchema = z.literal([1, 2, 3, 4, 5, 6]);
export type LadderStufe = z.infer<typeof ladderStufeSchema>;

/** The module works on Niveau M with E as an additive path (spec 2.4). */
export const niveauSchema = z.enum(["M", "E"]);
export type ModuleNiveau = z.infer<typeof niveauSchema>;

export const legibilitySchema = z.number().min(0).max(1);

/** Adds an issue when the given texts together exceed a word limit (spec 7.3, 7.6). */
export function checkWordLimit(
  ctx: z.RefinementCtx,
  texts: readonly string[],
  limit: number,
  path: (string | number)[],
): void {
  const words = texts.reduce((sum, t) => sum + countWords(t), 0);
  if (words > limit) {
    ctx.addIssue({ code: "custom", path, message: `${words} words, limit is ${limit}` });
  }
}

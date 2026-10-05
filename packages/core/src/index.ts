import { z } from "zod";

/** School types. Directory names under modules/ use these values. */
export const SCHULARTEN = ["gesamtschule", "gymnasium"] as const;
export type Schulart = (typeof SCHULARTEN)[number];

/** Performance levels of the Bildungsplan 2016 BW, Sekundarstufe I. */
export const NIVEAUS = ["G", "M", "E"] as const;
export type Niveau = (typeof NIVEAUS)[number];

/** Devices a module is designed for. "paper" means work happens on paper first. */
export const DEVICES = ["ipad", "smartphone", "pc", "paper"] as const;
export type Device = (typeof DEVICES)[number];

/** Model tiers. Modules choose a tier, never a concrete model. */
export const LLM_TIERS = ["vision", "hard", "light"] as const;
export type LlmTier = (typeof LLM_TIERS)[number];

/**
 * Personal data categories with platform-wide retention rules.
 * See docs/datenschutz/README.md, section 2.
 */
export const DATA_CATEGORIES = [
  "access",
  "photos",
  "content",
  "progress",
  "llm_calls",
  "server_logs",
] as const;
export type DataCategory = (typeof DATA_CATEGORIES)[number];

export const MODULE_STATUS = ["planung", "entwicklung", "pilot", "aktiv"] as const;

export const retentionOverrideSchema = z.object({
  category: z.enum(DATA_CATEGORIES),
  days: z.number().int().positive(),
  /** Every deviation from the platform default needs a written reason. */
  reason: z.string().min(20),
});
export type RetentionOverride = z.infer<typeof retentionOverrideSchema>;

export const moduleManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  title: z.string().min(1),
  schulart: z.enum(SCHULARTEN),
  klasse: z.number().int().min(1).max(13),
  fach: z.string().min(1),
  niveaus: z.array(z.enum(NIVEAUS)).min(1),
  devices: z.array(z.enum(DEVICES)).min(1),
  offline: z.boolean(),
  llmTiers: z.array(z.enum(LLM_TIERS)),
  retentionOverrides: z.array(retentionOverrideSchema).default([]),
  status: z.enum(MODULE_STATUS),
});
export type ModuleManifest = z.infer<typeof moduleManifestSchema>;
export type ModuleManifestInput = z.input<typeof moduleManifestSchema>;

/** Validates a module manifest at import time, so a broken manifest fails fast. */
export function defineModule(manifest: ModuleManifestInput): ModuleManifest {
  return moduleManifestSchema.parse(manifest);
}

/** Path segment of a module below modules/, for example "gesamtschule/klasse-10". */
export function moduleClassPath(m: Pick<ModuleManifest, "schulart" | "klasse">): string {
  return `${m.schulart}/klasse-${String(m.klasse).padStart(2, "0")}`;
}

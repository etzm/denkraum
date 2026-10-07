import { z } from "zod";

// Configuration of the garden layer (docs/spielschicht.md, SW-29 to SW-36).
// Rules live in domain/garden.ts; this file holds thresholds, holidays and
// the German labels the child sees, so they can change without code changes.

export const PLANT_STAGES = ["seed", "sown", "sprout", "leaves", "bud", "bloom"] as const;
export type PlantStage = (typeof PLANT_STAGES)[number];

export const VITALITY_LEVELS = ["fresh", "thirsty", "wilted", "dormant"] as const;
export type Vitality = (typeof VITALITY_LEVELS)[number];

/** House parts in build order. The M path completes the house up to the chimney; the weather vane needs stage 6. */
export const HOUSE_PARTS = ["foundation", "walls", "door", "windows", "roof", "greenhouse", "chimney", "weather_vane"] as const;
export type HousePart = (typeof HOUSE_PARTS)[number];

export const VISITORS = ["butterfly", "bee", "squirrel", "hedgehog", "blackbird", "owl"] as const;
export type Visitor = (typeof VISITORS)[number];

const label = z.string().min(1).max(40);
const message = z.string().min(1).max(200);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hex = z.string().regex(/^#[0-9a-f]{6}$/);

const varietySchema = z.object({
  name: label,
  /** Colour of the bloom, chosen per run by a hash of the run id and shown only once it blooms. */
  colors: z.array(z.object({ id: z.string().regex(/^[a-z_]+$/), name: label, hex })).min(1).max(8),
});

export const gardenConfigSchema = z.object({
  vitality: z
    .object({
      /** Inactive counting days from which the garden is thirsty, wilted, dormant. */
      thirstyAfter: z.number().int().min(1),
      wiltedAfter: z.number().int().min(2),
      dormantAfter: z.number().int().min(3),
      /** false: Saturdays and Sundays do not count as inactive days. */
      countWeekends: z.boolean(),
    })
    .refine((v) => v.thirstyAfter < v.wiltedAfter && v.wiltedAfter < v.dormantAfter, {
      message: "thresholds must increase",
    }),
  /** School holidays: inactive days in here do not count, the garden rests (SW-30). */
  ferien: z
    .array(z.object({ name: label, from: day, to: day }).refine((f) => f.from <= f.to, { message: "from after to" }))
    .max(40),
  /** Where the holiday dates come from. Movable school days (bewegliche Ferientage) are added per school. */
  ferienSource: z.url(),
  varieties: z.object({
    "1": varietySchema,
    "2": varietySchema,
    "3": varietySchema,
    "4": varietySchema,
    "5": varietySchema,
    "6": varietySchema,
    boss: varietySchema,
  }),
  labels: z.object({
    plantStages: z.object(Object.fromEntries(PLANT_STAGES.map((s) => [s, label])) as Record<PlantStage, typeof label>),
    houseParts: z.object(Object.fromEntries(HOUSE_PARTS.map((p) => [p, label])) as Record<HousePart, typeof label>),
    visitors: z.object(Object.fromEntries(VISITORS.map((v) => [v, label])) as Record<Visitor, typeof label>),
  }),
  /** Warm, never shaming; every message names the way back (SW-30). */
  messages: z.object({
    fresh: message,
    thirsty: message,
    wilted: message,
    dormant: message,
    ferien: message,
    empty: message,
  }),
});

export type GardenConfig = z.infer<typeof gardenConfigSchema>;

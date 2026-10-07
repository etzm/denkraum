import { z } from "zod";
import { ladderStufeSchema, niveauSchema, stufeSchema } from "./common.ts";
import { EXERCISE_TYPES } from "./exercise.ts";

// Seed content (spec 10). Field names follow the data model in spec 8.

const text = (max: number) => z.string().min(1).max(max);

export const missionSchema = z
  .object({
    id: z.string().regex(/^(m-0[1-6]-0\d|boss-\d{2})$/),
    stufe: stufeSchema,
    order: z.number().int().min(1),
    niveau: niveauSchema,
    schreibform: z.enum(["stellungnahme", "eroerterung_linear"]),
    title: text(120),
    /** The task as the student reads it (Du-Form). */
    prompt: text(800),
    /** Extra sentence for students on Niveau E (boss only). */
    promptNiveauE: text(300).optional(),
    /** Null for revision missions without an addressee (stage 5). */
    adressat: text(80).nullable(),
    operator: text(40),
    form: text(120),
    /** Minutes, soft timer; 0 when there is no planning phase. */
    timeboxPlan: z.number().int().min(0).max(30),
    timeboxWrite: z.number().int().min(1).max(45),
    checklistId: z.string().regex(/^cl-(0[1-6]|boss)$/),
    helpCardIds: z.array(z.string().regex(/^HK-\d{2}$/)),
    requiresExerciseStationId: z.string().regex(/^st-0[1-6]-\d{2}$/).nullable(),
    /** Stage 5: the earlier mission whose text is revised. */
    revisesMissionId: z.string().optional(),
    /** Stage 5: a given weak sample text to revise, as paragraphs. */
    givenText: z.array(text(1200)).min(1).optional(),
    /** Boss: hidden topic pool (spec 10.1). */
    topics: z.array(z.object({ id: z.string(), thema: text(160), adressat: text(80) })).optional(),
    bossMode: z.boolean(),
    /** Set by hand after review by the German teacher (spec 10.1). */
    approved: z.boolean(),
  })
  .refine((m) => m.bossMode === (m.stufe === "boss"), { message: "bossMode must match stufe", path: ["bossMode"] })
  .refine((m) => !m.bossMode || (m.topics?.length ?? 0) === 5, { message: "boss needs 5 topics", path: ["topics"] });

export type Mission = z.infer<typeof missionSchema>;

export const helpCardSchema = z.object({
  id: z.string().regex(/^HK-\d{2}$/),
  title: text(60),
  stufe: ladderStufeSchema,
  niveau: niveauSchema,
  /** Price in keys while the card's stage is current (spec 3.2). */
  cost: z.number().int().min(0).max(3),
  content: z.object({
    intro: text(300),
    phrases: z.array(text(200)).min(1).max(12),
  }),
  approved: z.boolean(),
});

export type HelpCard = z.infer<typeof helpCardSchema>;

export const checklistSchema = z.object({
  id: z.string().regex(/^cl-(0[1-6]|boss)$/),
  /** Self check items, first person as the student says them (spec 10.3). */
  items: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9_]+$/),
        text: text(160),
        /** Shown only when Niveau E is enabled. */
        niveauE: z.boolean().optional(),
      }),
    )
    .min(1),
  approved: z.boolean(),
});

export type Checklist = z.infer<typeof checklistSchema>;

export const stationSchema = z.object({
  id: z.string().regex(/^st-0[1-6]-\d{2}$/),
  stufe: ladderStufeSchema,
  order: z.number().int().min(1),
  title: text(80),
  /** Demonstration station of stages 1 and 2 (spec 2.3). */
  demo: z.boolean(),
  exerciseTypes: z.array(z.enum(EXERCISE_TYPES)).min(1),
  size: z.number().int().min(1),
  passThreshold: z.number().int().min(1),
});

export type ExerciseStation = z.infer<typeof stationSchema>;

/** Rubric dimensions A to D (spec 7.1). */
export const RUBRIC_DIMENSIONS = ["aufbau", "argumentation", "sprache", "richtigkeit"] as const;
export type RubricDimension = (typeof RUBRIC_DIMENSIONS)[number];

/** Rubric as P4 receives it (spec 7.1). One per writing form and Niveau. */
export const rubricSchema = z.object({
  id: z.string().regex(/^[a-z_]+-[me]$/),
  schreibform: z.enum(["stellungnahme", "eroerterung_linear"]),
  niveau: niveauSchema,
  dimensions: z
    .array(
      z.object({
        id: z.enum(RUBRIC_DIMENSIONS),
        label: text(40),
        note: text(200).optional(),
        /** Descriptions for 0, 1, 2 and 3 stars. */
        levels: z.array(text(200)).length(4),
      }),
    )
    .length(4)
    .refine((dims) => dims.map((d) => d.id).join() === RUBRIC_DIMENSIONS.join(), {
      message: "dimensions must be A to D in order",
    }),
  /** E bonus criteria, one star each; rated only with Niveau E (spec 7.1). */
  eBonus: z.array(text(160)).length(3),
  approved: z.boolean(),
});

export type Rubric = z.infer<typeof rubricSchema>;

export const missionFileSchema = z.array(missionSchema);
export const helpCardFileSchema = z.array(helpCardSchema);
export const checklistFileSchema = z.array(checklistSchema);
export const stationFileSchema = z.array(stationSchema);
export const rubricFileSchema = z.array(rubricSchema);

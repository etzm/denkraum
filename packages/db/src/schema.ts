import { boolean, index, integer, jsonb, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Platform tables. Personal data is minimal by design (docs/datenschutz/README.md):
 * no real names, no e-mail addresses of learners, no device or location data.
 * Deleting a group cascades to everything that belongs to it.
 */

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** A class or, for a home pilot, a single learner with one adult. */
export const groups = pgTable("groups", {
  id: id(),
  kind: text("kind", { enum: ["class", "individual"] }).notNull(),
  /** Short label chosen by the teacher, for example "10b Mathe". Never a learner's name. */
  label: text("label").notNull(),
  schulart: text("schulart").notNull(),
  klasse: integer("klasse").notNull(),
  joinCode: text("join_code").notNull().unique(),
  /** End of the school year or pilot. Everything in the group is deleted after this date. */
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

export const learners = pgTable(
  "learners",
  {
    id: id(),
    groupId: text("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
    /** Generated, never chosen (privacy/pseudonym.ts). */
    pseudonym: text("pseudonym").notNull(),
    /** Personal code to continue on another device. */
    personalCode: text("personal_code").notNull().unique(),
    niveau: text("niveau", { enum: ["G", "M", "E"] }),
    /** Set only by a human (DECISIONS.md, D-006). */
    niveauEEnabled: boolean("niveau_e_enabled").notNull().default(false),
    createdAt: createdAt(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
  },
  (t) => [index("learners_group_idx").on(t.groupId)],
);

/** Read-only access for a teacher (whole group) or a parent (one learner). */
export const viewers = pgTable("viewers", {
  id: id(),
  groupId: text("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  learnerId: text("learner_id").references(() => learners.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["teacher", "parent"] }).notNull(),
  readCode: text("read_code").notNull().unique(),
  createdAt: createdAt(),
});

/** Server-side sessions. Only a hash of the cookie token is stored. */
export const sessions = pgTable("sessions", {
  id: id(),
  tokenHash: text("token_hash").notNull().unique(),
  learnerId: text("learner_id").references(() => learners.id, { onDelete: "cascade" }),
  viewerId: text("viewer_id").references(() => viewers.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/** One submission of photographed (or typed) work. */
export const uploads = pgTable(
  "uploads",
  {
    id: id(),
    learnerId: text("learner_id").notNull().references(() => learners.id, { onDelete: "cascade" }),
    moduleId: text("module_id").notNull(),
    kind: text("kind").notNull(),
    /** Module reference, for example a worksheet or mission run id. Never learner data. */
    ref: text("ref"),
    round: integer("round").notNull().default(1),
    typed: boolean("typed").notNull().default(false),
    /** Object storage keys, in page order. Emptied when the images are deleted. */
    storageKeys: jsonb("storage_keys").$type<string[]>().notNull().default([]),
    imagesDeleteAfter: timestamp("images_delete_after", { withTimezone: true }).notNull(),
    imagesDeletedAt: timestamp("images_deleted_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("uploads_learner_idx").on(t.learnerId), index("uploads_images_due_idx").on(t.imagesDeleteAfter)],
);

/** Raw and confirmed transcript. Revisions are new rows, never overwrites. */
export const transcripts = pgTable("transcripts", {
  id: id(),
  uploadId: text("upload_id").notNull().references(() => uploads.id, { onDelete: "cascade" }),
  raw: jsonb("raw").notNull(),
  confirmed: jsonb("confirmed"),
  legibility: real("legibility"),
  editDistanceRatio: real("edit_distance_ratio"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/** AI feedback, always with the prompt version that produced it. */
export const feedback = pgTable("feedback", {
  id: id(),
  uploadId: text("upload_id").notNull().references(() => uploads.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  promptName: text("prompt_name").notNull(),
  promptVersion: integer("prompt_version").notNull(),
  model: text("model").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: createdAt(),
});

/** Model call log without content and without learner reference. */
export const llmCalls = pgTable(
  "llm_calls",
  {
    id: id(),
    moduleId: text("module_id").notNull(),
    promptName: text("prompt_name").notNull(),
    promptVersion: integer("prompt_version").notNull(),
    tier: text("tier").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    attempt: integer("attempt").notNull(),
    status: text("status").notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    latencyMs: integer("latency_ms").notNull(),
    costUsd: real("cost_usd"),
    createdAt: createdAt(),
  },
  (t) => [index("llm_calls_created_idx").on(t.createdAt)],
);

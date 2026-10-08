import {
  boolean,
  feedback,
  index,
  integer,
  jsonb,
  learners,
  pgTable,
  text,
  timestamp,
  transcripts,
  uniqueIndex,
  uploads,
  viewers,
} from "@denkraum/sdk/db";

/**
 * Tables of the trigonometry module (docs/module-sdk.md). Every row hangs on a learner with
 * cascade, so deleting a learner or a group removes it. No learner data beyond the learner id;
 * seeds are random per sheet and never derived from the learner.
 */

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const learnerId = () => text("learner_id").notNull().references(() => learners.id, { onDelete: "cascade" });

/** One worksheet with individual numbers (spec A 5.4, D-012). */
export const trigWorksheets = pgTable(
  "trig_worksheets",
  {
    id: id(),
    learnerId: learnerId(),
    lesson: integer("lesson").notNull(),
    niveau: text("niveau", { enum: ["G", "M", "E"] }).notNull(),
    /** Random per sheet; parameters are drawn from it (domain/generator.ts). */
    seed: text("seed").notNull(),
    /** 4 characters written on the paper next to each solution (D-024). */
    sheetCode: text("sheet_code").notNull(),
    taskIds: jsonb("task_ids").$type<string[]>().notNull(),
    /** Parameters per task as drawn, so the numbers never change with later code. */
    params: jsonb("params").$type<Record<string, Record<string, number>>>().notNull(),
    /** Attempt number per task on this sheet. */
    attempts: jsonb("attempts").$type<Record<string, number>>().notNull(),
    /** The faded tasks were done "mit Hilfe" (spec A 5.3). */
    withHelp: boolean("with_help").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("trig_worksheets_learner_idx").on(t.learnerId)],
);

/** One attempt at a faded task on screen (spec A 5.3). */
export const trigChecks = pgTable(
  "trig_checks",
  {
    id: id(),
    learnerId: learnerId(),
    taskId: text("task_id").notNull(),
    niveau: text("niveau", { enum: ["G", "M", "E"] }).notNull(),
    attemptNo: integer("attempt_no").notNull(),
    correct: boolean("correct").notNull(),
    misconceptionCodes: jsonb("misconception_codes").$type<string[]>().notNull().default([]),
    /** What was typed or chosen, by hidden step index. */
    answers: jsonb("answers").$type<Record<string, string>>().notNull(),
    hint: text("hint"),
    createdAt: createdAt(),
  },
  (t) => [index("trig_checks_learner_idx").on(t.learnerId, t.taskId)],
);

/** Verified result of one paper task on one sheet (spec A 6.1 step 4 to 6). */
export const trigResults = pgTable(
  "trig_results",
  {
    id: id(),
    learnerId: learnerId(),
    worksheetId: text("worksheet_id")
      .notNull()
      .references(() => trigWorksheets.id, { onDelete: "cascade" }),
    uploadId: text("upload_id")
      .notNull()
      .references(() => uploads.id, { onDelete: "cascade" }),
    transcriptId: text("transcript_id").references(() => transcripts.id, { onDelete: "set null" }),
    taskId: text("task_id").notNull(),
    attemptNo: integer("attempt_no").notNull(),
    status: text("status", { enum: ["correct", "partially_correct", "incorrect", "not_found"] }).notNull(),
    misconceptionCodes: jsonb("misconception_codes").$type<string[]>().notNull().default([]),
    /** VerificationResult of domain/verify.ts. */
    verification: jsonb("verification").notNull(),
    /** The AI-phrased feedback, if it was usable; otherwise the catalog hint is shown. */
    feedbackId: text("feedback_id").references(() => feedback.id, { onDelete: "set null" }),
    /** "ai", or why the catalog hint is shown: "refused", "timeout", "error", "schema_error", "reveal_guard". */
    feedbackSource: text("feedback_source").notNull(),
    solutionViewed: boolean("solution_viewed").notNull().default(false),
    solutionViewedAt: timestamp("solution_viewed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("trig_results_learner_idx").on(t.learnerId, t.taskId),
    uniqueIndex("trig_results_sheet_task_idx").on(t.worksheetId, t.taskId),
  ],
);

/**
 * Corrections by the teacher (DECISIONS.md D-031, module DECISIONS T-43): an event log, never
 * overwritten. The latest row per result is in force; "clear" takes the correction back.
 */
export const trigOverrides = pgTable(
  "trig_overrides",
  {
    id: id(),
    learnerId: learnerId(),
    resultId: text("result_id")
      .notNull()
      .references(() => trigResults.id, { onDelete: "cascade" }),
    /** Who corrected; kept as a pseudonymous id, emptied if the teacher code is removed. */
    viewerId: text("viewer_id").references(() => viewers.id, { onDelete: "set null" }),
    kind: text("kind", { enum: ["status", "void", "clear"] }).notNull(),
    /** The new status, only for kind "status". */
    status: text("status", { enum: ["correct", "partially_correct", "incorrect", "not_found"] }),
    /** Shown to the learner too. */
    reason: text("reason").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("trig_overrides_learner_idx").on(t.learnerId), index("trig_overrides_result_idx").on(t.resultId)],
);

// Tables of the Schreibwerkstatt, prefixed `sw_` (umsetzungsplan 2). The migration is
// generated with the platform tables (`pnpm db:generate`) into packages/db/drizzle.
// Everything belongs to a learner and is deleted with them (cascade), and with the group.

import { boolean, index, integer, jsonb, pgTable, schema, text, timestamp, uniqueIndex } from "@denkraum/db";
import type { MissionEvent } from "./domain/state.ts";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const learnerRef = () => text("learner_id").notNull().references(() => schema.learners.id, { onDelete: "cascade" });

/** One attempt at a mission. The event log is the source of truth; `state` is its projection for listings. */
export const swMissionRuns = pgTable(
  "sw_mission_runs",
  {
    id: id(),
    learnerId: learnerRef(),
    missionId: text("mission_id").notNull(),
    /** "1" to "6" or "boss". */
    stufe: text("stufe").notNull(),
    /** Snapshot at start (MissionRun.niveauEEnabled). */
    niveauEEnabled: boolean("niveau_e_enabled").notNull(),
    state: text("state").notNull(),
    /** Boss: the topic drawn for this run (SW-36). */
    bossTopicId: text("boss_topic_id"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    /** Boss: start of the server-side timer (spec 3.4). */
    writingStartedAt: timestamp("writing_started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("sw_mission_runs_learner_idx").on(t.learnerId)],
);

/**
 * Append-only event log of a run (SW-22). Nothing is overwritten; a run is `replay`ed
 * from these rows. AI results carry the prompt name, version and model (spec 0, 7.3).
 */
export const swMissionEvents = pgTable(
  "sw_mission_events",
  {
    id: id(),
    runId: text("run_id")
      .notNull()
      .references(() => swMissionRuns.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<MissionEvent>().notNull(),
    /** Who caused the event. */
    source: text("source", { enum: ["student", "system", "adult"] }).notNull(),
    promptName: text("prompt_name"),
    promptVersion: integer("prompt_version"),
    model: text("model"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("sw_mission_events_run_seq_idx").on(t.runId, t.seq)],
);

/** Finished station rounds (spec 5). */
export const swExerciseAttempts = pgTable(
  "sw_exercise_attempts",
  {
    id: id(),
    learnerId: learnerRef(),
    stationId: text("station_id").notNull(),
    exerciseIds: jsonb("exercise_ids").$type<string[]>().notNull(),
    answers: jsonb("answers").$type<unknown[]>().notNull(),
    results: jsonb("results").$type<boolean[]>().notNull(),
    passed: boolean("passed").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sw_exercise_attempts_learner_idx").on(t.learnerId)],
);

/** Help cards bought with keys (spec 3.2, SW-14). */
export const swUnlocks = pgTable(
  "sw_unlocks",
  {
    id: id(),
    learnerId: learnerRef(),
    helpCardId: text("help_card_id").notNull(),
    keysPaid: integer("keys_paid").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("sw_unlocks_learner_card_idx").on(t.learnerId, t.helpCardId)],
);

/**
 * Every change of XP and keys with its reason (SW-07). The unique index makes a reward
 * idempotent: a mission completion or a streak day is booked once, even on a retry.
 */
export const swLedger = pgTable(
  "sw_ledger",
  {
    id: id(),
    learnerId: learnerRef(),
    kind: text("kind", { enum: ["xp", "keys"] }).notNull(),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    /** Run id, attempt id, help card id or Berlin day, depending on the reason. */
    refId: text("ref_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("sw_ledger_once_idx").on(t.learnerId, t.kind, t.reason, t.refId)],
);

/** Projection of the ledger and of activity, updated in the same transaction. */
export const swProgress = pgTable("sw_progress", {
  learnerId: text("learner_id")
    .primaryKey()
    .references(() => schema.learners.id, { onDelete: "cascade" }),
  xp: integer("xp").notNull().default(0),
  keys: integer("keys").notNull().default(0),
  streakDays: integer("streak_days").notNull().default(0),
  /** Berlin day of the last streak activity (station round or completed mission, SW-17). */
  streakLastDay: text("streak_last_day"),
  /** Berlin day of the last activity of any kind, for the garden vitality (SW-30). */
  lastActiveDay: text("last_active_day"),
  badges: jsonb("badges").$type<string[]>().notNull().default([]),
  /** Set once when the system suggests Niveau E (SW-05). An adult decides. */
  ePathSuggestedAt: timestamp("e_path_suggested_at", { withTimezone: true }),
  /** Cosmetic garden choices (SW-32). */
  cosmetics: jsonb("cosmetics").$type<Record<string, string>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Content released by an adult for one group (D-022). A mission, help card or exercise is
 * usable when its JSON has `approved: true` or a row here exists for the learner's group.
 */
export const swContentApprovals = pgTable(
  "sw_content_approvals",
  {
    id: id(),
    groupId: text("group_id")
      .notNull()
      .references(() => schema.groups.id, { onDelete: "cascade" }),
    contentId: text("content_id").notNull(),
    approvedByViewerId: text("approved_by_viewer_id").references(() => schema.viewers.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("sw_content_approvals_group_content_idx").on(t.groupId, t.contentId)],
);

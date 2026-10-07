// Own tables of the Schreibwerkstatt (docs/module-sdk.md). Prefix sw_, every row hangs on a
// learner with ON DELETE CASCADE, so the deletion job and erasure per pseudonym remove it too.
//
// What the student writes and what the model answers is NOT only kept here: every plan, text
// and revision is an `uploads` row (typed = true) with its content in `transcripts`, every AI
// result is a `feedback` row with prompt name, version and model (SW-31). This table holds the
// state machine data of a mission run, so a run can be resumed in every state.

import { index, integer, jsonb, learners, pgTable, text, timestamp } from "@denkraum/sdk/db";
import type { FormativeStars } from "./domain/rules.ts";
import type { MissionRun } from "./domain/state.ts";

export const swMissionRuns = pgTable(
  "sw_mission_runs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    learnerId: text("learner_id").notNull().references(() => learners.id, { onDelete: "cascade" }),
    /** Mission template id from content/missions.json, for example "m-04-01". */
    missionId: text("mission_id").notNull(),
    /** Copy of `data.state` for queries. */
    state: text("state").notNull(),
    /** The run as the state machine sees it (domain/state.ts). Changed only through `transition`. */
    data: jsonb("data").$type<MissionRun>().notNull(),
    /** Optimistic lock: every save increments it, a stale save is refused. */
    version: integer("version").notNull().default(0),
    /** Formative stars shown to the student (D-020). Gates nothing. */
    stars: jsonb("stars").$type<FormativeStars>(),
    xp: integer("xp").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("sw_mission_runs_learner_idx").on(t.learnerId, t.missionId)],
);

export type SwMissionRunRow = typeof swMissionRuns.$inferSelect;

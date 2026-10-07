// Persistence of mission runs. Content goes to the platform tables (uploads, transcripts,
// feedback) append-only, so export, deletion and retention cover it (SW-31). The run row in
// sw_mission_runs holds the state machine data and is updated with an optimistic lock.

import { and, desc, eq, feedback, transcripts, uploads, type Db } from "@denkraum/sdk/db";
import { swMissionRuns, type SwMissionRunRow } from "../db.ts";
import type { FormativeStars } from "../domain/rules.ts";
import type { MissionRun } from "../domain/state.ts";

export type RunRow = SwMissionRunRow;

export async function insertRun(db: Db, input: { learnerId: string; run: MissionRun; now: Date }): Promise<RunRow> {
  const [row] = await db
    .insert(swMissionRuns)
    .values({
      learnerId: input.learnerId,
      missionId: input.run.missionId,
      state: input.run.state,
      data: input.run,
      startedAt: input.now,
      updatedAt: input.now,
    })
    .returning();
  return row!;
}

/** A run of this learner, or null (other learners' runs are invisible). */
export async function findRun(db: Db, learnerId: string, runId: string): Promise<RunRow | null> {
  const [row] = await db
    .select()
    .from(swMissionRuns)
    .where(and(eq(swMissionRuns.id, runId), eq(swMissionRuns.learnerId, learnerId)));
  return row ?? null;
}

export async function latestRun(db: Db, learnerId: string, missionId: string): Promise<RunRow | null> {
  const [row] = await db
    .select()
    .from(swMissionRuns)
    .where(and(eq(swMissionRuns.learnerId, learnerId), eq(swMissionRuns.missionId, missionId)))
    .orderBy(desc(swMissionRuns.startedAt))
    .limit(1);
  return row ?? null;
}

/**
 * Stores the next run data if nobody else saved in between (version check).
 * Returns the saved row, or null when the row changed meanwhile (double submit).
 */
export async function saveRun(
  db: Db,
  row: RunRow,
  data: MissionRun,
  now: Date,
  derived: { stars: FormativeStars | null; xp: number },
): Promise<RunRow | null> {
  const completed = data.state === "completed";
  const [saved] = await db
    .update(swMissionRuns)
    .set({
      data,
      state: data.state,
      version: row.version + 1,
      updatedAt: now,
      completedAt: completed ? (row.completedAt ?? now) : row.completedAt,
      stars: derived.stars,
      xp: derived.xp,
    })
    .where(and(eq(swMissionRuns.id, row.id), eq(swMissionRuns.version, row.version)))
    .returning();
  return saved ?? null;
}

export type SubmissionKind = "plan" | "text" | "revision";

/**
 * A typed submission is an upload without photos (`typed = true`) with its content as
 * transcript; for typed input raw and confirmed are the same (no reading errors to correct).
 */
export async function insertTypedSubmission(
  db: Db,
  input: { learnerId: string; moduleId: string; kind: SubmissionKind; runId: string; round: number; content: unknown; now: Date },
): Promise<string> {
  const [upload] = await db
    .insert(uploads)
    .values({
      learnerId: input.learnerId,
      moduleId: input.moduleId,
      kind: input.kind,
      ref: input.runId,
      round: input.round,
      typed: true,
      storageKeys: [],
      // No photos exist, so there is nothing for the photo deletion job to do.
      imagesDeleteAfter: input.now,
      imagesDeletedAt: input.now,
      createdAt: input.now,
    })
    .returning({ id: uploads.id });
  await db.insert(transcripts).values({
    uploadId: upload!.id,
    raw: input.content,
    confirmed: input.content,
    legibility: null,
    editDistanceRatio: 0,
    confirmedAt: input.now,
    createdAt: input.now,
  });
  return upload!.id;
}

/** The newest submission of a kind for a run (highest round, then newest). */
export async function latestSubmissionId(
  db: Db,
  input: { learnerId: string; moduleId: string; runId: string; kind: SubmissionKind },
): Promise<string | null> {
  const [row] = await db
    .select({ id: uploads.id })
    .from(uploads)
    .where(
      and(
        eq(uploads.learnerId, input.learnerId),
        eq(uploads.moduleId, input.moduleId),
        eq(uploads.ref, input.runId),
        eq(uploads.kind, input.kind),
      ),
    )
    .orderBy(desc(uploads.round), desc(uploads.createdAt))
    .limit(1);
  return row?.id ?? null;
}

export type FeedbackKind = "plan_review" | "text_review" | "revision_check";

/** Every validated model answer is kept, also retries and held reviews (spec 0: never overwrite). */
export async function insertFeedback(
  db: Db,
  input: { uploadId: string; kind: FeedbackKind; promptName: string; promptVersion: number; model: string; payload: unknown; now: Date },
): Promise<void> {
  await db.insert(feedback).values({
    uploadId: input.uploadId,
    kind: input.kind,
    promptName: input.promptName,
    promptVersion: input.promptVersion,
    model: input.model,
    payload: input.payload,
    createdAt: input.now,
  });
}

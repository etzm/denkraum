import { z } from "zod";
import type { Niveau } from "@denkraum/core";
import type { ModuleContext } from "@denkraum/sdk";
import { and, asc, desc, eq, feedback, inArray, learners, transcripts } from "@denkraum/sdk/db";
import { trigChecks, trigOverrides, trigResults, trigWorksheets } from "../db.ts";
import { aiFeedbackSchema, parseStoredTranscription, type AiFeedback, type AiTranscription } from "../domain/ai.ts";
import type { PriorResult } from "../domain/lesson.ts";
import { applyOverrides, countedResults, type EffectiveResult, type OverrideEntry } from "../domain/overrides.ts";
import { transcribedTaskSchema, type TranscribedTask } from "../domain/schema.ts";

/** Database access of the module. Every query is scoped to the current learner. */

export type Worksheet = typeof trigWorksheets.$inferSelect;
export type Result = typeof trigResults.$inferSelect;
export type Check = typeof trigChecks.$inferSelect;

export async function setNiveau(ctx: ModuleContext, niveau: Niveau): Promise<void> {
  await ctx.db.update(learners).set({ niveau }).where(eq(learners.id, ctx.learner.id));
}

export function checksOf(ctx: ModuleContext, taskIds: readonly string[]): Promise<Check[]> {
  if (taskIds.length === 0) return Promise.resolve([]);
  return ctx.db
    .select()
    .from(trigChecks)
    .where(and(eq(trigChecks.learnerId, ctx.learner.id), inArray(trigChecks.taskId, [...taskIds])))
    .orderBy(asc(trigChecks.createdAt), asc(trigChecks.attemptNo));
}

export async function addCheck(ctx: ModuleContext, row: Omit<typeof trigChecks.$inferInsert, "learnerId">): Promise<void> {
  await ctx.db.insert(trigChecks).values({ ...row, learnerId: ctx.learner.id });
}

export function worksheetsOf(ctx: ModuleContext, lesson: number): Promise<Worksheet[]> {
  return ctx.db
    .select()
    .from(trigWorksheets)
    .where(and(eq(trigWorksheets.learnerId, ctx.learner.id), eq(trigWorksheets.lesson, lesson)))
    .orderBy(desc(trigWorksheets.createdAt));
}

export async function worksheet(ctx: ModuleContext, id: string | undefined): Promise<Worksheet | null> {
  if (!id) return null;
  const [row] = await ctx.db
    .select()
    .from(trigWorksheets)
    .where(and(eq(trigWorksheets.id, id), eq(trigWorksheets.learnerId, ctx.learner.id)));
  return row ?? null;
}

export async function addWorksheet(ctx: ModuleContext, row: Omit<typeof trigWorksheets.$inferInsert, "learnerId">): Promise<Worksheet> {
  const [created] = await ctx.db.insert(trigWorksheets).values({ ...row, learnerId: ctx.learner.id }).returning();
  return created!;
}

/** All results of the learner for the given paper tasks, oldest first. */
export function resultsOf(ctx: ModuleContext, taskIds: readonly string[]): Promise<Result[]> {
  if (taskIds.length === 0) return Promise.resolve([]);
  return ctx.db
    .select()
    .from(trigResults)
    .where(and(eq(trigResults.learnerId, ctx.learner.id), inArray(trigResults.taskId, [...taskIds])))
    .orderBy(asc(trigResults.createdAt), asc(trigResults.attemptNo));
}

export function resultsOfSheet(ctx: ModuleContext, worksheetId: string): Promise<Result[]> {
  return ctx.db
    .select()
    .from(trigResults)
    .where(and(eq(trigResults.learnerId, ctx.learner.id), eq(trigResults.worksheetId, worksheetId)));
}

/** Results as stored, before any correction: only for numbering new attempts (planWorksheet, T-33). */
export function asPrior(results: readonly Result[]): PriorResult[] {
  return results.map((r) => ({ taskId: r.taskId, attemptNo: r.attemptNo, status: r.status, solutionViewed: r.solutionViewed }));
}

export type Override = typeof trigOverrides.$inferSelect;

export function asOverrideEntries(rows: readonly Override[]): OverrideEntry[] {
  return rows.map((o) => ({ resultId: o.resultId, kind: o.kind, status: o.status, reason: o.reason, createdAt: o.createdAt }));
}

/** Results with the teacher's corrections applied (D-031). */
export async function effectiveResultsOf(ctx: ModuleContext, results: readonly Result[]): Promise<EffectiveResult[]> {
  if (results.length === 0) return [];
  const overrides = await ctx.db
    .select()
    .from(trigOverrides)
    .where(and(eq(trigOverrides.learnerId, ctx.learner.id), inArray(trigOverrides.resultId, results.map((r) => r.id))));
  return applyOverrides(results, asOverrideEntries(overrides));
}

/** What the lesson rules count for these tasks: corrected results, without attempts that do not count. */
export async function countedOf(ctx: ModuleContext, taskIds: readonly string[]): Promise<EffectiveResult[]> {
  return countedResults(await effectiveResultsOf(ctx, await resultsOf(ctx, taskIds)));
}

export async function addResults(ctx: ModuleContext, rows: Omit<typeof trigResults.$inferInsert, "learnerId">[]): Promise<void> {
  if (rows.length === 0) return;
  await ctx.db.insert(trigResults).values(rows.map((row) => ({ ...row, learnerId: ctx.learner.id })));
}

export async function markSolutionViewed(ctx: ModuleContext, resultId: string): Promise<void> {
  await ctx.db
    .update(trigResults)
    .set({ solutionViewed: true, solutionViewedAt: ctx.now })
    .where(and(eq(trigResults.id, resultId), eq(trigResults.learnerId, ctx.learner.id)));
}

// ---------------------------------------------------------------------------
// Platform tables: transcripts and feedback hang on an upload; the upload's owner is checked first.

export interface StoredTranscript {
  id: string;
  /** null when the model gave no usable answer (refused, timeout, error, schema_error). */
  transcription: AiTranscription | null;
  failure: string | null;
  confirmed: boolean;
}

/** Latest transcript of an upload that belongs to this learner and this module. */
export async function transcriptOf(ctx: ModuleContext, uploadId: string): Promise<StoredTranscript | null> {
  if (!(await ctx.uploads.get(uploadId))) return null;
  const [row] = await ctx.db
    .select()
    .from(transcripts)
    .where(eq(transcripts.uploadId, uploadId))
    .orderBy(desc(transcripts.createdAt))
    .limit(1);
  if (!row) return null;
  const raw = row.raw as { transcription?: unknown; failure?: string };
  const transcription = parseStoredTranscription(raw.transcription);
  return {
    id: row.id,
    transcription,
    failure: transcription ? null : (raw.failure ?? "error"),
    confirmed: row.confirmedAt !== null,
  };
}

export async function addTranscript(
  ctx: ModuleContext,
  uploadId: string,
  raw: Record<string, unknown>,
  legibility: number | null,
): Promise<void> {
  await ctx.db.insert(transcripts).values({ uploadId, raw, legibility });
}

export async function confirmTranscript(ctx: ModuleContext, id: string, confirmed: unknown, editDistanceRatio: number): Promise<void> {
  await ctx.db.update(transcripts).set({ confirmed, confirmedAt: ctx.now, editDistanceRatio }).where(eq(transcripts.id, id));
}

const confirmedSchema = z.object({ tasks: z.array(transcribedTaskSchema) });

/** The confirmed transcription of a transcript row (one entry per task). */
export async function confirmedOf(ctx: ModuleContext, transcriptId: string): Promise<TranscribedTask[]> {
  const [row] = await ctx.db.select({ confirmed: transcripts.confirmed }).from(transcripts).where(eq(transcripts.id, transcriptId));
  const parsed = confirmedSchema.safeParse(row?.confirmed);
  return parsed.success ? parsed.data.tasks : [];
}

export async function addFeedback(
  ctx: ModuleContext,
  row: { uploadId: string; promptName: string; promptVersion: number; model: string; payload: AiFeedback },
): Promise<string> {
  const [created] = await ctx.db
    .insert(feedback)
    .values({ ...row, kind: "trig_task" })
    .returning({ id: feedback.id });
  return created!.id;
}

/** AI feedback texts by id, only those that still parse against the schema. */
export async function feedbackTexts(ctx: ModuleContext, ids: readonly string[]): Promise<Map<string, AiFeedback>> {
  const out = new Map<string, AiFeedback>();
  if (ids.length === 0) return out;
  const rows = await ctx.db.select().from(feedback).where(inArray(feedback.id, [...ids]));
  for (const row of rows) {
    const parsed = aiFeedbackSchema.safeParse(row.payload);
    if (parsed.success) out.set(row.id, parsed.data);
  }
  return out;
}

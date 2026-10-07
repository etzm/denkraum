import { z } from "zod";
import type { TeacherAction, TeacherContext } from "@denkraum/sdk";
import { and, asc, eq, inArray, learners, transcripts, uploads } from "@denkraum/sdk/db";
import { trigChecks, trigOverrides, trigResults, trigWorksheets } from "../db.ts";
import type { MisconceptionCode } from "../domain/misconceptions.ts";
import { activeOverride, applyOverrides, parseOverride, type EffectiveResult } from "../domain/overrides.ts";
import type { OverviewAttempt } from "../domain/overview.ts";
import { transcribedTaskSchema, type TranscribedTask } from "../domain/schema.ts";
import { asOverrideEntries, type Override, type Result } from "./store.ts";

/**
 * Database access of the teacher view (D-030, D-031). Every query is scoped to the teacher's
 * group through the learners table; the teacher sees results and confirmed transcripts, never
 * photos (docs/datenschutz/README.md, section 4).
 */

export interface GroupResult {
  learnerId: string;
  row: Result;
  effective: EffectiveResult;
}

/** All results of the group for these tasks with the corrections applied, oldest first. */
export async function groupResults(ctx: TeacherContext, taskIds: readonly string[]): Promise<GroupResult[]> {
  if (taskIds.length === 0) return [];
  const rows = (
    await ctx.db
      .select({ result: trigResults })
      .from(trigResults)
      .innerJoin(learners, eq(trigResults.learnerId, learners.id))
      .where(and(eq(learners.groupId, ctx.group.id), inArray(trigResults.taskId, [...taskIds])))
      .orderBy(asc(trigResults.createdAt), asc(trigResults.attemptNo))
  ).map((r) => r.result);
  const overrides = await groupOverrides(ctx, rows.map((r) => r.id));
  // Corrections renumber attempts per learner and task, so they are applied per learner.
  const byLearner = new Map<string, Result[]>();
  for (const row of rows) byLearner.set(row.learnerId, [...(byLearner.get(row.learnerId) ?? []), row]);
  const effective = new Map<string, EffectiveResult>();
  for (const own of byLearner.values()) {
    for (const e of applyOverrides(own, asOverrideEntries(overrides))) effective.set(e.resultId, e);
  }
  return rows.map((row) => ({ learnerId: row.learnerId, row, effective: effective.get(row.id)! }));
}

/** The correction log of these results, oldest first. */
export async function groupOverrides(ctx: TeacherContext, resultIds: readonly string[]): Promise<Override[]> {
  if (resultIds.length === 0) return [];
  return (
    await ctx.db
      .select({ override: trigOverrides })
      .from(trigOverrides)
      .innerJoin(learners, eq(trigOverrides.learnerId, learners.id))
      .where(and(eq(learners.groupId, ctx.group.id), inArray(trigOverrides.resultId, [...resultIds])))
      .orderBy(asc(trigOverrides.createdAt))
  ).map((r) => r.override);
}

/** Attempts for the error picture: counted paper results (corrected) and all faded-task checks. */
export async function overviewAttempts(ctx: TeacherContext, paperIds: readonly string[], fadedIds: readonly string[]): Promise<OverviewAttempt[]> {
  const paper = (await groupResults(ctx, paperIds))
    .filter((r) => r.effective.counted)
    .map(
      (r): OverviewAttempt => ({
        learnerId: r.learnerId,
        taskId: r.row.taskId,
        attemptNo: r.effective.attemptNo,
        status: r.effective.status,
        codes: r.effective.codes,
        createdAt: r.row.createdAt,
      }),
    );
  if (fadedIds.length === 0) return paper;
  const checks = await ctx.db
    .select({ check: trigChecks })
    .from(trigChecks)
    .innerJoin(learners, eq(trigChecks.learnerId, learners.id))
    .where(and(eq(learners.groupId, ctx.group.id), inArray(trigChecks.taskId, [...fadedIds])));
  const faded = checks.map(
    ({ check }): OverviewAttempt => ({
      learnerId: check.learnerId,
      taskId: check.taskId,
      attemptNo: check.attemptNo,
      status: check.correct ? "correct" : "incorrect",
      codes: check.misconceptionCodes as MisconceptionCode[],
      createdAt: check.createdAt,
    }),
  );
  return [...paper, ...faded];
}

/** A learner of the group, or null. */
export function learnerOf(ctx: TeacherContext, learnerId: string | undefined) {
  return ctx.learners.find((l) => l.id === learnerId) ?? null;
}

/** Sheet codes of these sheets, to name an attempt the way the learner wrote it on paper. */
export async function sheetCodes(ctx: TeacherContext, sheetIds: readonly string[]): Promise<Map<string, string>> {
  if (sheetIds.length === 0) return new Map();
  const rows = await ctx.db
    .select({ id: trigWorksheets.id, code: trigWorksheets.sheetCode })
    .from(trigWorksheets)
    .innerJoin(learners, eq(trigWorksheets.learnerId, learners.id))
    .where(and(eq(learners.groupId, ctx.group.id), inArray(trigWorksheets.id, [...sheetIds])));
  return new Map(rows.map((r) => [r.id, r.code]));
}

const confirmedSchema = z.object({ tasks: z.array(transcribedTaskSchema) });

/** Confirmed transcriptions by transcript id: what the learner confirmed, not the photo. */
export async function confirmedTasks(ctx: TeacherContext, transcriptIds: readonly string[]): Promise<Map<string, TranscribedTask[]>> {
  const ids = [...new Set(transcriptIds)];
  if (ids.length === 0) return new Map();
  const rows = await ctx.db
    .select({ id: transcripts.id, confirmed: transcripts.confirmed })
    .from(transcripts)
    .innerJoin(uploads, eq(transcripts.uploadId, uploads.id))
    .innerJoin(learners, eq(uploads.learnerId, learners.id))
    .where(and(inArray(transcripts.id, ids), eq(learners.groupId, ctx.group.id)));
  return new Map(
    rows.map((r) => {
      const parsed = confirmedSchema.safeParse(r.confirmed);
      return [r.id, parsed.success ? parsed.data.tasks : []];
    }),
  );
}

const field = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

/**
 * Correction by the teacher (D-031): a new status or "this attempt does not count", always with
 * a reason, or taking a correction back. Only for results of the teacher's own group.
 */
const korrigieren: TeacherAction = async (ctx, form) => {
  const resultId = field(form, "ergebnis");
  const [found] = await ctx.db
    .select({ result: trigResults })
    .from(trigResults)
    .innerJoin(learners, eq(trigResults.learnerId, learners.id))
    .where(and(eq(trigResults.id, resultId), eq(learners.groupId, ctx.group.id)));
  if (!found) return { redirect: ctx.basePath };
  const { result } = found;
  const page = `${ctx.basePath}/lernende/${result.learnerId}`;

  const [kind = "", status = ""] = field(form, "wahl").split(":");
  const current = activeOverride(asOverrideEntries(await groupOverrides(ctx, [result.id])), result.id);
  const parsed = parseOverride({ kind, status, reason: field(form, "grund").slice(0, 2000) }, current, result.status);
  if (!parsed.ok) return { redirect: `${page}?fehler=${parsed.error}&ergebnis=${result.id}#ergebnis-${result.id}` };

  const { request } = parsed;
  await ctx.db.insert(trigOverrides).values({
    learnerId: result.learnerId,
    resultId: result.id,
    viewerId: ctx.viewer.id,
    kind: request.kind,
    status: request.kind === "status" ? request.status : null,
    reason: request.reason,
    createdAt: ctx.now,
  });
  return { redirect: `${page}?gespeichert=${result.id}#ergebnis-${result.id}` };
};

export const TEACHER_ACTIONS: Record<string, TeacherAction> = { korrigieren };

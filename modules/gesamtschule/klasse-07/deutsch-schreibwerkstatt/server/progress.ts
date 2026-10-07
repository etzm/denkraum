// Progress of a learner: XP and keys as an append-only ledger with a projection, activity
// days for the garden, streak, badges and the Niveau E suggestion. Rules come from
// domain/rules.ts (SW-07, SW-17, SW-18, SW-05); this file only books and stores.

import { and, asc, eq, sql } from "@denkraum/db";
import { swExerciseAttempts, swLedger, swMissionRuns, swProgress, swUnlocks } from "../db.ts";
import type { BadgeId, ProgressContext } from "../domain/rules.ts";
import { BADGE_IDS, berlinDay, earnedBadges, isEPathSuggested, registerActivity, XP } from "../domain/rules.ts";
import type { MissionRun } from "../domain/state.ts";
import { badgeStats, runStars } from "../domain/summary.ts";
import type { Queryable } from "./types.ts";

export type ProgressRow = typeof swProgress.$inferSelect;

export async function ensureProgress(q: Queryable, learnerId: string): Promise<void> {
  await q.insert(swProgress).values({ learnerId }).onConflictDoNothing();
}

export async function getProgress(q: Queryable, learnerId: string): Promise<ProgressRow> {
  await ensureProgress(q, learnerId);
  const [row] = await q.select().from(swProgress).where(eq(swProgress.learnerId, learnerId));
  return row!;
}

export type LedgerReason =
  | "mission_completed"
  | "revision_submitted"
  | "streak_day"
  | "station_passed"
  | "station_first_pass"
  | "help_card"
  | "joker";

/**
 * Books a change once per (learner, kind, reason, refId) and updates the projection.
 * Returns false when it was booked before (retries and double submits are harmless).
 */
export async function book(
  q: Queryable,
  entry: { learnerId: string; kind: "xp" | "keys"; delta: number; reason: LedgerReason; refId: string; at: Date },
): Promise<boolean> {
  await ensureProgress(q, entry.learnerId);
  const inserted = await q
    .insert(swLedger)
    .values({
      learnerId: entry.learnerId,
      kind: entry.kind,
      delta: entry.delta,
      reason: entry.reason,
      refId: entry.refId,
      createdAt: entry.at,
    })
    .onConflictDoNothing()
    .returning({ id: swLedger.id });
  if (inserted.length === 0) return false;
  const column = entry.kind === "xp" ? swProgress.xp : swProgress.keys;
  await q
    .update(swProgress)
    .set(entry.kind === "xp" ? { xp: sql`${column} + ${entry.delta}`, updatedAt: entry.at } : { keys: sql`${column} + ${entry.delta}`, updatedAt: entry.at })
    .where(eq(swProgress.learnerId, entry.learnerId));
  return true;
}

/** Any finished station round or mission step: keeps the garden fresh (SW-30). */
export async function markActivity(q: Queryable, learnerId: string, at: Date): Promise<void> {
  await ensureProgress(q, learnerId);
  await q.update(swProgress).set({ lastActiveDay: berlinDay(at), updatedAt: at }).where(eq(swProgress.learnerId, learnerId));
}

/** Streak activity (finished station round or completed mission, SW-17): first activity of a day earns XP. */
export async function registerStreakActivity(q: Queryable, learnerId: string, at: Date): Promise<void> {
  const progress = await getProgress(q, learnerId);
  const result = registerActivity({ days: progress.streakDays, lastActiveDay: progress.streakLastDay }, at);
  if (!result.newDay) return;
  await q
    .update(swProgress)
    .set({ streakDays: result.streak.days, streakLastDay: result.streak.lastActiveDay, updatedAt: at })
    .where(eq(swProgress.learnerId, learnerId));
  await book(q, { learnerId, kind: "xp", delta: result.xp, reason: "streak_day", refId: result.streak.lastActiveDay!, at });
}

/** Adds newly earned badges; a badge once earned stays (rewards only, they gate nothing). */
export async function refreshBadges(q: Queryable, learnerId: string, runs: readonly MissionRun[], at: Date): Promise<BadgeId[]> {
  const progress = await getProgress(q, learnerId);
  const earned = earnedBadges(badgeStats(runs, { streakDays: progress.streakDays, correctCompleteBbb: 0 }));
  const all = BADGE_IDS.filter((id) => progress.badges.includes(id) || earned.includes(id));
  const added = all.filter((id) => !progress.badges.includes(id));
  if (added.length > 0) {
    await q.update(swProgress).set({ badges: all, updatedAt: at }).where(eq(swProgress.learnerId, learnerId));
  }
  return added;
}

/** The system only suggests Niveau E; an adult decides (SW-05). Reads the formative stars of stage 4. */
export async function refreshEPathSuggestion(
  q: Queryable,
  learnerId: string,
  stage4CompletedInOrder: readonly MissionRun[],
  at: Date,
): Promise<boolean> {
  const scores = stage4CompletedInOrder.map(runStars).filter((s) => s !== null).map((s) => s.scores);
  if (!isEPathSuggested(scores)) return false;
  const progress = await getProgress(q, learnerId);
  if (progress.ePathSuggestedAt) return false;
  await q.update(swProgress).set({ ePathSuggestedAt: at, updatedAt: at }).where(eq(swProgress.learnerId, learnerId));
  return true;
}

/** Rewards when a run changed: revision submitted (once per run) and mission completed. */
export async function onRunChanged(
  q: Queryable,
  input: { learnerId: string; runId: string; before: MissionRun; after: MissionRun; allRuns: () => Promise<MissionRun[]>; at: Date },
): Promise<void> {
  const { learnerId, runId, before, after, at } = input;
  if (before.revision.texts.length === 0 && after.revision.texts.length > 0) {
    await book(q, { learnerId, kind: "xp", delta: XP.revisionSubmitted, reason: "revision_submitted", refId: runId, at });
  }
  if (before.state !== "completed" && after.state === "completed") {
    await book(q, { learnerId, kind: "xp", delta: XP.missionCompleted, reason: "mission_completed", refId: runId, at });
    await registerStreakActivity(q, learnerId, at);
    const runs = await input.allRuns();
    await refreshBadges(q, learnerId, runs, at);
    if (after.stufe === 4) {
      await refreshEPathSuggestion(q, learnerId, runs.filter((r) => r.stufe === 4 && r.state === "completed"), at);
    }
  }
}

/** Facts the unlock rules read (SW-15). Completed missions come from the runs, passed stations from the attempts. */
export async function progressContext(
  q: Queryable,
  learner: { id: string; niveauEEnabled: boolean },
): Promise<ProgressContext> {
  const completed = await q
    .selectDistinct({ missionId: swMissionRuns.missionId })
    .from(swMissionRuns)
    .where(and(eq(swMissionRuns.learnerId, learner.id), eq(swMissionRuns.state, "completed")));
  const passed = await q
    .selectDistinct({ stationId: swExerciseAttempts.stationId })
    .from(swExerciseAttempts)
    .where(and(eq(swExerciseAttempts.learnerId, learner.id), eq(swExerciseAttempts.passed, true)));
  return {
    niveauEEnabled: learner.niveauEEnabled,
    completedMissionIds: completed.map((r) => r.missionId),
    passedStationIds: passed.map((r) => r.stationId),
  };
}

export async function unlockedHelpCardIds(q: Queryable, learnerId: string): Promise<string[]> {
  const rows = await q
    .select({ id: swUnlocks.helpCardId })
    .from(swUnlocks)
    .where(eq(swUnlocks.learnerId, learnerId))
    .orderBy(asc(swUnlocks.createdAt));
  return rows.map((r) => r.id);
}

/** XP and keys booked for one run, for the completion screen. */
export async function rewardsForRun(q: Queryable, learnerId: string, runId: string): Promise<{ xp: number; keys: number }> {
  const rows = await q
    .select({ kind: swLedger.kind, delta: swLedger.delta })
    .from(swLedger)
    .where(and(eq(swLedger.learnerId, learnerId), eq(swLedger.refId, runId)));
  return {
    xp: rows.filter((r) => r.kind === "xp").reduce((n, r) => n + r.delta, 0),
    keys: rows.filter((r) => r.kind === "keys").reduce((n, r) => n + r.delta, 0),
  };
}

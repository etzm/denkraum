import { MISCONCEPTION_CODES, MISCONCEPTIONS, type MisconceptionCode } from "./misconceptions.ts";
import type { VerificationStatus } from "./verify.ts";

/**
 * Error picture of a class (DECISIONS.md D-030, module DECISIONS T-42): which error types
 * verify() found, per task and for the lesson, and with which learners. Built from the
 * corrected results only (overrides.ts); no language model is involved.
 */

export interface OverviewAttempt {
  learnerId: string;
  taskId: string;
  attemptNo: number;
  status: VerificationStatus;
  codes: readonly MisconceptionCode[];
  createdAt: Date;
}

export interface CodeCount {
  code: MisconceptionCode;
  label: string;
  /** Learners whose latest attempt shows the error: who needs help now. */
  learnerIds: string[];
  /** All counted attempts with the error, also earlier ones. */
  attempts: number;
}

export interface TaskOverview {
  taskId: string;
  /** Learners with at least one counted attempt. */
  learners: number;
  /** Status of each learner's latest attempt. */
  latest: Record<VerificationStatus, number>;
  codes: CodeCount[];
}

const later = (a: OverviewAttempt, b: OverviewAttempt) =>
  a.createdAt.getTime() > b.createdAt.getTime() || (a.createdAt.getTime() === b.createdAt.getTime() && a.attemptNo > b.attemptNo);

function sortCodes(counts: Map<MisconceptionCode, CodeCount>): CodeCount[] {
  return [...counts.values()].sort(
    (a, b) =>
      b.learnerIds.length - a.learnerIds.length || b.attempts - a.attempts || MISCONCEPTION_CODES.indexOf(a.code) - MISCONCEPTION_CODES.indexOf(b.code),
  );
}

function count(counts: Map<MisconceptionCode, CodeCount>, code: MisconceptionCode): CodeCount {
  let entry = counts.get(code);
  if (!entry) {
    entry = { code, label: MISCONCEPTIONS[code].label, learnerIds: [], attempts: 0 };
    counts.set(code, entry);
  }
  return entry;
}

/** One entry per task, in the given order; tasks nobody has worked on yet have zero counts. */
export function taskOverview(taskIds: readonly string[], attempts: readonly OverviewAttempt[]): TaskOverview[] {
  return taskIds.map((taskId) => {
    const ofTask = attempts.filter((a) => a.taskId === taskId);
    const latestByLearner = new Map<string, OverviewAttempt>();
    const counts = new Map<MisconceptionCode, CodeCount>();
    for (const a of ofTask) {
      const current = latestByLearner.get(a.learnerId);
      if (!current || later(a, current)) latestByLearner.set(a.learnerId, a);
      for (const code of new Set(a.codes)) count(counts, code).attempts++;
    }
    const latest: Record<VerificationStatus, number> = { correct: 0, partially_correct: 0, incorrect: 0, not_found: 0 };
    for (const [learnerId, a] of latestByLearner) {
      latest[a.status]++;
      for (const code of new Set(a.codes)) count(counts, code).learnerIds.push(learnerId);
    }
    return { taskId, learners: latestByLearner.size, latest, codes: sortCodes(counts) };
  });
}

/** The lesson as a whole: a learner counts for a code if their latest attempt at any task shows it. */
export function lessonCodes(tasks: readonly TaskOverview[]): CodeCount[] {
  const counts = new Map<MisconceptionCode, CodeCount>();
  for (const task of tasks) {
    for (const c of task.codes) {
      const entry = count(counts, c.code);
      entry.attempts += c.attempts;
      for (const id of c.learnerIds) if (!entry.learnerIds.includes(id)) entry.learnerIds.push(id);
    }
  }
  return sortCodes(counts);
}

import type { PriorResult } from "./lesson.ts";
import type { MisconceptionCode } from "./misconceptions.ts";
import { VERIFICATION_STATUSES, type VerificationStatus } from "./verify.ts";

/**
 * Corrections by the teacher (DECISIONS.md D-031, module DECISIONS T-43). The teacher can
 * overrule the status that verify() decided, or decide that an attempt does not count, so the
 * learner gets another attempt. Every correction needs a reason and is kept as a log entry;
 * the latest entry per result is in force, "clear" takes the correction back.
 * Pure functions: the lesson rules (lesson.ts) then work on the corrected results.
 */

export const OVERRIDE_KINDS = ["status", "void", "clear"] as const;
export type OverrideKind = (typeof OVERRIDE_KINDS)[number];

export const REASON_MIN = 5;
export const REASON_MAX = 300;

export interface OverrideEntry {
  resultId: string;
  kind: OverrideKind;
  status: VerificationStatus | null;
  reason: string;
  createdAt: Date;
}

export interface ResultEntry {
  id: string;
  taskId: string;
  attemptNo: number;
  status: VerificationStatus;
  misconceptionCodes: readonly string[];
  solutionViewed: boolean;
  createdAt: Date;
}

export interface ActiveOverride {
  kind: "status" | "void";
  /** The new status for kind "status". */
  status: VerificationStatus | null;
  reason: string;
  createdAt: Date;
}

export interface EffectiveResult extends PriorResult {
  resultId: string;
  /** What verify() decided. */
  originalStatus: VerificationStatus;
  /** Codes in force: none once the teacher has set the result to correct. */
  codes: MisconceptionCode[];
  /** False when the teacher decided that this attempt does not count. */
  counted: boolean;
  override: ActiveOverride | null;
  createdAt: Date;
}

/** The correction in force for a result: its latest log entry, unless that entry takes it back. */
export function activeOverride(overrides: readonly OverrideEntry[], resultId: string): ActiveOverride | null {
  let latest: OverrideEntry | undefined;
  for (const o of overrides) {
    if (o.resultId === resultId && (!latest || o.createdAt >= latest.createdAt)) latest = o;
  }
  if (!latest || latest.kind === "clear") return null;
  return { kind: latest.kind, status: latest.kind === "status" ? latest.status : null, reason: latest.reason, createdAt: latest.createdAt };
}

const before = (a: ResultEntry, b: ResultEntry) =>
  a.createdAt.getTime() < b.createdAt.getTime() || (a.createdAt.getTime() === b.createdAt.getTime() && a.attemptNo < b.attemptNo);

/**
 * Results with the corrections applied. An attempt that does not count is moved out of the
 * numbering: every later attempt at the same task moves up by one, so "first or second
 * attempt" (lessonPassed) counts only the attempts that count.
 */
export function applyOverrides(results: readonly ResultEntry[], overrides: readonly OverrideEntry[]): EffectiveResult[] {
  const active = new Map(results.map((r) => [r.id, activeOverride(overrides, r.id)]));
  return results.map((r) => {
    const override = active.get(r.id) ?? null;
    const voidedBefore = results.filter((x) => x.taskId === r.taskId && before(x, r) && active.get(x.id)?.kind === "void").length;
    const status = override?.kind === "status" && override.status ? override.status : r.status;
    const codes = override?.kind === "status" && status === "correct" ? [] : (r.misconceptionCodes as MisconceptionCode[]);
    return {
      resultId: r.id,
      taskId: r.taskId,
      attemptNo: r.attemptNo - voidedBefore,
      status,
      originalStatus: r.status,
      codes,
      counted: override?.kind !== "void",
      solutionViewed: r.solutionViewed,
      override,
      createdAt: r.createdAt,
    };
  });
}

/** The results the lesson rules count: corrected, without the attempts that do not count. */
export function countedResults(results: readonly EffectiveResult[]): EffectiveResult[] {
  return results.filter((r) => r.counted);
}

export type OverrideRequest =
  | { kind: "status"; status: VerificationStatus; reason: string }
  | { kind: "void"; reason: string }
  | { kind: "clear"; reason: string };

export type OverrideError = "kind" | "status" | "reason" | "unchanged";

/**
 * Checks a correction from the teacher form against the correction in force and the status
 * verify() decided. The reason is trimmed and must have 5 to 300 characters.
 */
export function parseOverride(
  input: { kind: string; status: string; reason: string },
  current: ActiveOverride | null,
  original: VerificationStatus,
): { ok: true; request: OverrideRequest } | { ok: false; error: OverrideError } {
  const reason = input.reason.replace(/\s+/g, " ").trim();
  if (!(OVERRIDE_KINDS as readonly string[]).includes(input.kind)) return { ok: false, error: "kind" };
  if (reason.length < REASON_MIN || reason.length > REASON_MAX) return { ok: false, error: "reason" };
  if (input.kind === "clear") return current ? { ok: true, request: { kind: "clear", reason } } : { ok: false, error: "unchanged" };
  if (input.kind === "void") return current?.kind === "void" ? { ok: false, error: "unchanged" } : { ok: true, request: { kind: "void", reason } };
  const status = input.status as VerificationStatus;
  if (!(VERIFICATION_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "status" };
  const inForce = current?.kind === "status" ? current.status : current ? null : original;
  if (inForce === status) return { ok: false, error: "unchanged" };
  return { ok: true, request: { kind: "status", status, reason } };
}

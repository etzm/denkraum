import type { DataCategory, RetentionOverride } from "@denkraum/core";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Platform defaults, see docs/datenschutz/README.md section 2.
 * "group_end": data lives until the end of the school year or pilot (Group.endsAt).
 */
export const RETENTION_DEFAULTS: Record<DataCategory, { days: number } | "group_end"> = {
  access: "group_end",
  photos: { days: 14 },
  content: "group_end",
  progress: "group_end",
  llm_calls: { days: 365 },
  server_logs: { days: 7 },
};

export interface RetentionInput {
  createdAt: Date;
  /** End of the school year or pilot for the learner's group. */
  groupEndsAt: Date;
}

/** Point in time after which a record of this category must be deleted. */
export function deletionDueAt(
  category: DataCategory,
  input: RetentionInput,
  overrides: readonly RetentionOverride[] = [],
): Date {
  const override = overrides.find((o) => o.category === category);
  if (override) return new Date(input.createdAt.getTime() + override.days * DAY_MS);
  const rule = RETENTION_DEFAULTS[category];
  if (rule === "group_end") return input.groupEndsAt;
  // Never keep beyond the group end, even if the day count would allow it.
  const byDays = new Date(input.createdAt.getTime() + rule.days * DAY_MS);
  return byDays < input.groupEndsAt ? byDays : input.groupEndsAt;
}

export function isDue(category: DataCategory, input: RetentionInput, now: Date, overrides?: readonly RetentionOverride[]): boolean {
  return deletionDueAt(category, input, overrides) <= now;
}

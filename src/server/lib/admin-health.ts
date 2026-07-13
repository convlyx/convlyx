export type SchoolHealth = "NEW" | "INACTIVE" | "AT_RISK" | "HEALTHY";

/** Tunable in ONE place — revisit numbers once real data is in. */
export const HEALTH_THRESHOLDS = {
  newDays: 21,
  quietDays: 14,
  dropWindowDays: 30,
  dropRatio: 0.6,
} as const;

/**
 * Single source of truth for the health badge used on the overview and account
 * pages. Precedence: INACTIVE > NEW > AT_RISK > HEALTHY.
 * - daysSinceActivity: days since the most recent of {class created, check-in,
 *   lastSeenAt}; null means no activity recorded at all.
 * - classesRecent/Previous: classes created in the last vs prior dropWindowDays.
 */
export function classifySchoolHealth(input: {
  tenantActive: boolean;
  ageDays: number;
  daysSinceActivity: number | null;
  classesRecent: number;
  classesPrevious: number;
}): SchoolHealth {
  if (!input.tenantActive) return "INACTIVE";
  if (input.ageDays < HEALTH_THRESHOLDS.newDays) return "NEW";

  const quiet =
    input.daysSinceActivity == null || input.daysSinceActivity >= HEALTH_THRESHOLDS.quietDays;

  const dropped =
    input.classesPrevious > 0 &&
    input.classesRecent / input.classesPrevious <= 1 - HEALTH_THRESHOLDS.dropRatio;

  if (quiet || dropped) return "AT_RISK";
  return "HEALTHY";
}

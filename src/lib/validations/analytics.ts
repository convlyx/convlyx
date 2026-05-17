import { z } from "zod/v4";

// Allowed values for the page-level range selector. The server derives the
// bin granularity (day / week / month) from rangeDays — see analyticsRouter.
export const ANALYTICS_RANGE_DAYS = [7, 30, 90, 365] as const;
export type AnalyticsRangeDays = (typeof ANALYTICS_RANGE_DAYS)[number];

const baseRange = z.object({
  rangeDays: z
    .union([z.literal(7), z.literal(30), z.literal(90), z.literal(365)])
    .default(30),
  schoolId: z.string().uuid().optional(),
});

export const analyticsRangeSchema = baseRange.optional();
export const enrolmentsOverTimeSchema = baseRange.optional();
export const attendanceTrendSchema = baseRange.optional();
export const passRateByCategorySchema = baseRange.optional();
export const instructorWorkloadSchema = baseRange.optional();

export type AnalyticsRangeInput = z.infer<typeof analyticsRangeSchema>;

export type AnalyticsGranularity = "day" | "week" | "month";

/**
 * Maps the page-level rangeDays choice to a chart bin granularity.
 * - 7d → daily bars (8 points)
 * - 30d → daily bars (30 points)
 * - 90d → weekly bars (~13 points)
 * - 365d → monthly bars (12 points)
 */
export function granularityFor(rangeDays: number): AnalyticsGranularity {
  if (rangeDays <= 30) return "day";
  if (rangeDays <= 90) return "week";
  return "month";
}

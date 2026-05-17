import type { AnalyticsGranularity } from "@/lib/validations/analytics";

const MONTH_NAMES_PT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

/**
 * Format a bucket key for chart X-axis display.
 *  - day:   "2026-05-17" → "17/05"
 *  - week:  "2026-05-12" → "12/05"
 *  - month: "2026-05"    → "Mai/26"
 */
export function formatBucket(bucket: string, granularity: AnalyticsGranularity): string {
  if (granularity === "month") {
    const [year, month] = bucket.split("-").map(Number);
    const m = MONTH_NAMES_PT[month - 1] ?? "";
    return `${m}/${String(year).slice(-2)}`;
  }
  // day & week use ISO date "YYYY-MM-DD"
  const [, m, d] = bucket.split("-");
  return `${d}/${m}`;
}

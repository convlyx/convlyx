import { type AnalyticsGranularity, granularityFor } from "@/lib/validations/analytics";

/**
 * Shared UTC day-boundary + time-series bucketing helpers. Used by the tenant
 * analytics router and the platform-admin routers so both bin dates the same
 * way. UTC throughout to avoid timezone drift across summer/winter.
 */

export { granularityFor };
export type { AnalyticsGranularity };

export function subDaysUTC(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() - days);
  return x;
}

export function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Returns the Monday (UTC midnight) of the week containing `d`. */
export function mondayOfUTC(d: Date): Date {
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const offset = day === 0 ? 6 : day - 1;
  const m = startOfDayUTC(d);
  m.setUTCDate(m.getUTCDate() - offset);
  return m;
}

export function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Bucket key for a given granularity. Stable, sortable, locale-free. */
export function bucketKey(d: Date, granularity: AnalyticsGranularity): string {
  if (granularity === "day") return d.toISOString().slice(0, 10);
  if (granularity === "week") return mondayOfUTC(d).toISOString().slice(0, 10);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Returns the chronological list of bucket keys covering the period
 * [now - rangeDays, now] at the given granularity. Used to seed bucket maps
 * with zeroes so empty periods render as a 0 bar rather than going missing.
 */
export function bucketKeysForRange(rangeDays: number, granularity: AnalyticsGranularity): string[] {
  const now = new Date();
  const keys: string[] = [];

  if (granularity === "day") {
    const start = startOfDayUTC(subDaysUTC(now, rangeDays - 1));
    for (let i = 0; i < rangeDays; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      keys.push(d.toISOString().slice(0, 10));
    }
    return keys;
  }

  if (granularity === "week") {
    const startMonday = mondayOfUTC(subDaysUTC(now, rangeDays - 1));
    const endMonday = mondayOfUTC(now);
    for (let cursor = new Date(startMonday); cursor <= endMonday; cursor.setUTCDate(cursor.getUTCDate() + 7)) {
      keys.push(cursor.toISOString().slice(0, 10));
    }
    return keys;
  }

  // month
  const months = Math.max(1, Math.round(rangeDays / 30));
  for (let i = months - 1; i >= 0; i--) {
    const d = startOfMonthUTC(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

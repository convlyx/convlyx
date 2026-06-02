// Date ranges for the dashboard panels. Computed once on the server (per
// request) and passed to the client panels as props, so the SSR prefetch and
// the client `useQuery` share the exact same input — otherwise the query key
// wouldn't match and the client would refetch, defeating the prefetch.
//
// Day boundaries use Portugal time (the market) so "today" is stable regardless
// of the server's UTC clock or the user's device timezone.

const TIME_ZONE = "Europe/Lisbon";

export type DateRange = { from: string; to: string };

// Minutes TIME_ZONE is ahead of UTC at `instant` (DST-aware).
function tzOffsetMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const v: Record<string, number> = {};
  for (const p of parts) if (p.type !== "literal") v[p.type] = Number(p.value);
  const asUtc = Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second);
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

// UTC instant for 00:00:00 of the Portugal-local day containing `instant`.
function startOfLocalDay(instant: Date): Date {
  const off = tzOffsetMinutes(instant);
  const wall = new Date(instant.getTime() + off * 60_000);
  const startWallUtc = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate());
  const approx = new Date(startWallUtc - off * 60_000);
  // Re-check the offset at the boundary in case DST changed between then and now.
  const offAtStart = tzOffsetMinutes(approx);
  return offAtStart === off ? approx : new Date(startWallUtc - offAtStart * 60_000);
}

/**
 * Ranges shared by the dashboard panels. Call once on the server per request
 * and pass each panel only the pieces it needs.
 *   - week:  now → +7 days (instant-based; "what's coming up")
 *   - today: 00:00:00 → 23:59:59.999 of the current Portugal day
 */
export function getPanelRanges(now: Date = new Date()): { week: DateRange; today: DateRange } {
  const weekTo = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const todayStart = startOfLocalDay(now);
  const tomorrowStart = startOfLocalDay(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const todayEnd = new Date(tomorrowStart.getTime() - 1);
  return {
    week: { from: now.toISOString(), to: weekTo.toISOString() },
    today: { from: todayStart.toISOString(), to: todayEnd.toISOString() },
  };
}

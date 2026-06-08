/**
 * Convert a wall-clock time in a given IANA timezone to its absolute UTC Date.
 * Treats the components as local to `timeZone`, regardless of the caller's
 * machine timezone, and handles DST automatically by querying the actual
 * offset on that date.
 *
 * @param month 0-based (JS `Date` convention)
 * @param timeZone IANA zone, e.g. "Europe/Lisbon" or "Atlantic/Azores"
 */
export function wallClockToUTC(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  // Naïve UTC date with the wall-clock components
  const naive = new Date(Date.UTC(year, month, day, hour, minute, 0, 0));

  // Find what those wall-clock components correspond to in the target zone
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(naive);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const localAsUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
  );
  // Difference between what the zone shows and the naive UTC = offset (in ms)
  const offsetMs = localAsUTC - naive.getTime();
  return new Date(naive.getTime() - offsetMs);
}

/**
 * Convert a wall-clock date + time pair in `timeZone` to a UTC ISO string.
 *
 * @param dateStr "YYYY-MM-DD"
 * @param timeStr "HH:MM"
 * @param timeZone IANA zone, e.g. "Europe/Lisbon" or "Atlantic/Azores"
 */
export function wallClockToISO(dateStr: string, timeStr: string, timeZone: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  return wallClockToUTC(year, month - 1, day, hour, minute, timeZone).toISOString();
}

/**
 * The hour-of-day (0–23) shown by `timeZone` at the given instant. Use this
 * instead of `Date#getHours()` in code that renders on both server and client:
 * `getHours()` reflects the *runtime's* timezone (UTC/Dublin on the server),
 * so it produces a different value than the user's browser and triggers
 * hydration mismatches.
 */
export function hourInTimeZone(instant: Date, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(instant),
  );
}

/**
 * The calendar day shown by `timeZone` at the given instant, as a sortable
 * "YYYY-MM-DD" key. Comparing two instants' day keys tells you whether they
 * fall on the same local day — DST-safe and independent of the runtime's own
 * timezone (so it's stable across SSR + client hydration).
 */
export function dayKeyInTimeZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

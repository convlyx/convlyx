/**
 * Convert a Lisbon wall-clock time (date + time) to a UTC ISO string.
 * Always treats the input as Europe/Lisbon time, regardless of the
 * caller's machine timezone. Handles DST automatically.
 *
 * @param dateStr "YYYY-MM-DD"
 * @param timeStr "HH:MM"
 */
export function lisbonWallClockToISO(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);

  // Naïve UTC date with the wall-clock components
  const naive = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));

  // Find what those wall-clock components correspond to in Lisbon
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(naive);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const lisbonAsUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
  );
  // Difference between what Lisbon shows and the naive UTC = offset (in ms)
  const offsetMs = lisbonAsUTC - naive.getTime();
  return new Date(naive.getTime() - offsetMs).toISOString();
}

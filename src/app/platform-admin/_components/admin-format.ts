/** Shared display formatters for the (non-i18n) platform-admin console. */

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Compact bucket label for the trend charts. */
export function formatBucket(bucket: string, granularity: "day" | "week" | "month"): string {
  if (granularity === "month") {
    const [y, m] = bucket.split("-");
    return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`;
  }
  const [, m, d] = bucket.split("-");
  return `${d}/${m}`;
}

/** Human account age from a day count. */
export function formatAge(days: number): string {
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}m`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem ? `${years}a ${rem}m` : `${years}a`;
}

/** dd/mm/yyyy for a Date (or "—"). */
export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getUTCFullYear()}`;
}

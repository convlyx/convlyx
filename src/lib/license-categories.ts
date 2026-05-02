/**
 * Portuguese (IMT) driving license categories.
 * Order is roughly progressive (light → heavy) for picker dropdowns.
 */
export const LICENSE_CATEGORIES = [
  "AM",
  "A1",
  "A2",
  "A",
  "B1",
  "B",
  "BE",
  "C1",
  "C1E",
  "C",
  "D1",
  "D1E",
  "D",
  "DE",
] as const;

export type LicenseCategory = (typeof LICENSE_CATEGORIES)[number];

/** Minimum legal age in years for each category. */
export const CATEGORY_MIN_AGE: Record<LicenseCategory, number> = {
  AM: 14,
  A1: 16,
  B1: 16,
  A2: 18,
  B: 18,
  BE: 18,
  C1: 18,
  C1E: 18,
  C: 21,
  D1: 21,
  D1E: 21,
  A: 24,
  D: 24,
  DE: 24,
};

import { z } from "zod/v4";
import { LICENSE_CATEGORIES, type LicenseCategory } from "@/lib/license-categories";

/** Codes map to `students.import.rowErrors.<code>` translation keys. */
export type RowErrorCode =
  | "nameRequired"
  | "emailInvalid"
  | "emailDuplicate"
  | "categoryRequired";

export type WorkingRow = {
  /** Stable client-side key (not persisted). */
  id: string;
  name: string;
  email: string;
  phone: string;
  category: LicenseCategory | "";
  /** Set when this email already belongs to a user in the tenant. */
  existing?: "ACTIVE" | "INACTIVE";
};

const emailSchema = z.email();

export function isValidCategory(value: string): value is LicenseCategory {
  return (LICENSE_CATEGORIES as readonly string[]).includes(value);
}

/** Count how many times each (normalized) email appears — to flag in-file dups. */
export function buildEmailCounts(rows: WorkingRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const email = row.email.trim().toLowerCase();
    if (!email) continue;
    counts.set(email, (counts.get(email) ?? 0) + 1);
  }
  return counts;
}

/**
 * Validate a single row against the field rules and the in-file email counts.
 * Returns the list of error codes (empty = valid). Pure — no React, no I/O — so
 * it's unit-testable and cheap to run live as the user edits cells.
 */
export function validateRow(
  row: WorkingRow,
  emailCounts: Map<string, number>,
): RowErrorCode[] {
  const errors: RowErrorCode[] = [];

  if (!row.name.trim()) errors.push("nameRequired");

  const email = row.email.trim();
  if (!emailSchema.safeParse(email).success) {
    errors.push("emailInvalid");
  } else if ((emailCounts.get(email.toLowerCase()) ?? 0) > 1) {
    errors.push("emailDuplicate");
  }

  if (!row.category || !isValidCategory(row.category)) {
    errors.push("categoryRequired");
  }

  return errors;
}

/**
 * A row will be sent to the server only if it's valid AND not an already-ACTIVE
 * student (those are shown but excluded — the import would just CONFLICT).
 * INACTIVE matches are importable: the server reactivates them.
 */
export function isImportable(
  row: WorkingRow,
  emailCounts: Map<string, number>,
): boolean {
  if (row.existing === "ACTIVE") return false;
  return validateRow(row, emailCounts).length === 0;
}

/** How many rows the "Import N students" action will actually submit. */
export function countImportable(rows: WorkingRow[]): number {
  const counts = buildEmailCounts(rows);
  return rows.filter((row) => isImportable(row, counts)).length;
}

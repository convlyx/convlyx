/**
 * Single source of truth for legal-document versions. Bumping a value re-triggers
 * the acceptance gate for that document (see src/server/routers/consent.ts). Use
 * the document's "last updated" date (ISO) as its version — human-legible and monotonic.
 */
export const LEGAL_VERSIONS = {
  terms: "2026-07-01", // bumped: §9 now incorporates the DPA
  privacy: "2026-06-04", // ← set to the value currently in politica-de-privacidade/page.tsx
  dpa: "2026-07-01", // new document
} as const;

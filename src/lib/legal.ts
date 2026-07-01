/**
 * Single source of truth for legal-document versions. Bumping a value re-triggers
 * the acceptance gate for that document (see src/server/routers/consent.ts). Use
 * the document's "last updated" date (ISO) as its version — human-legible and monotonic.
 */
export const LEGAL_VERSIONS = {
  terms: "2026-07-01", // bumped: §9 now incorporates the DPA
  privacy: "2026-06-04", // ← set to the value currently in politica-de-privacidade/page.tsx
  // DRAFT pending legal review ("carece de revisão jurídica" banner). Consent
  // acceptances collected now are against the DRAFT. ⚠️ REMINDER: once the DPA
  // wording is legally signed off, BUMP this date — that re-prompts every school
  // (and user, if `terms` also changes) to accept the FINAL version, superseding
  // the draft acceptances.
  dpa: "2026-07-01",
} as const;

/**
 * Sub-processors that may process personal data on our behalf. SINGLE SOURCE OF
 * TRUTH rendered by BOTH the Privacy Policy ("Com quem partilhamos os seus dados")
 * and the DPA ("Subcontratantes autorizados"), so the two lists can never drift.
 * Add/remove a vendor here and both pages update.
 *
 * NOTE: names, purposes, and locations are subject to the DPA's pending legal
 * review. `location` is a short human note; the SCC/EEA-transfer mechanics live
 * in the "Transferências internacionais" sections of both documents.
 */
export type SubProcessor = { name: string; purpose: string; location: string };

export const SUBPROCESSORS: SubProcessor[] = [
  { name: "Supabase", purpose: "base de dados e autenticação", location: "UE (eu-west-1)" },
  { name: "Vercel", purpose: "alojamento e execução da aplicação", location: "UE (Dublin); empresa sediada nos EUA" },
  { name: "Resend", purpose: "envio de emails transacionais", location: "EUA" },
  { name: "PostHog", purpose: "análise de utilização agregada da aplicação", location: "instância na UE" },
  { name: "Sentry", purpose: "monitorização de erros e diagnóstico", location: "EUA" },
];

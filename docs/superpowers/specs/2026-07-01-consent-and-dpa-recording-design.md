# Consent & DPA recording — design spec

**Date:** 2026-07-01
**Status:** Approved design — ready for implementation plan
**Author:** Francisco (with Claude)
**Parent:** workstream C of `docs/superpowers/specs/2026-06-24-pre-launch-hardening-and-cross-tenant-identity-design.md`

## Context & goal

The product has legal *pages* (Terms, Privacy, Cookies) but **no recorded acceptance**
of them, and the DPA (Data Processing Agreement / Contrato de Subcontratação, RGPD
Art. 28.º) is only offered *"mediante pedido"* — so agreeing to the Terms does not
currently bind the school to the Art. 28 processor clauses.

This feature closes that gap: publish a proper DPA, incorporate it into the Terms, and
**record versioned, timestamped acceptance** by (a) the school as controller (Art. 28)
and (b) each individual user (evidence each data subject saw the terms).

Secondary goal: its schema change is a single **additive** table — the ideal low-risk
first migration to run through the now-trusted `db:migrate:deploy:prod` pipeline
(see the routing investigation in `docs/decisions/2026-06-24-prod-db-routing-investigation.md`).

**Not legal advice.** The DPA clause *wording* must get a legal review before go-live;
this spec defines the *structure and mechanics*, which are what we build.

## Decisions locked during brainstorming

- **Hybrid DPA** (best practice for EU/PT B2B SaaS): a standalone, versioned DPA
  document, **incorporated into the Terms by reference and viewable at signup** (not "on
  request"), covered by a single click-through acceptance. Not embedded into the ToS body;
  not a separate signature step.
- **Record both**: the school admin's controller/DPA acceptance *and* each user's
  Terms+Privacy acceptance.
- **PT/EU specifics that the DPA content must cover:** sub-processor list (Supabase,
  Vercel, Resend, PostHog, Sentry) and EEA-transfer safeguards (SCCs) for US-based
  sub-processors. PostHog and Sentry genuinely receive identifiable personal data
  (`analytics-identifier.tsx` sets Sentry user id/email + PostHog person properties).

## Non-goals (YAGNI)

- Dashboard **cookie-consent** control — separate open item (C1); no migration; not here.
- **Per-membership** consent — revisit when workstream D (cross-tenant identity) lands;
  per-user is correct for the current one-user-per-tenant model.
- Separate per-enterprise negotiated DPAs — handled as a one-off, not the default flow.
- Backfilling acceptance for existing users — consent must be *actively given*; existing
  users are simply prompted on next login.

## Data model

One additive table. No backfill, no changes to existing tables/data.

```prisma
enum ConsentType {
  CONTROLLER_DPA   // school admin accepting Terms + DPA on behalf of the school (Art. 28)
  USER_TERMS       // an individual user accepting Terms + Privacy Policy
}

model ConsentRecord {
  id               String      @id @default(uuid()) @db.Uuid
  tenantId         String      @map("tenant_id") @db.Uuid
  // Nullable + SetNull: a consent log must stay legible even if the person is later
  // deleted/anonymised. The email/name snapshots below preserve who accepted.
  userId           String?     @map("user_id") @db.Uuid
  type             ConsentType
  // Snapshot of accepted document versions, e.g. {"terms":"2026-06-04","dpa":"2026-07-01"}
  // (CONTROLLER_DPA) or {"terms":"2026-06-04","privacy":"2026-06-04"} (USER_TERMS).
  documentVersions Json        @map("document_versions")
  acceptedByEmail  String      @map("accepted_by_email")
  acceptedByName   String      @map("accepted_by_name")
  ipAddress        String?     @map("ip_address")
  acceptedAt       DateTime    @default(now()) @map("accepted_at")

  tenant Tenant @relation(fields: [tenantId], references: [id])
  user   User?  @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([tenantId])
  @@index([userId])
  @@index([tenantId, type])
  @@map("consent_records")
}
```

- Add `ConsentRecord` to `TENANT_SCOPED_MODELS` in `src/server/lib/tenant-scope.ts`
  (it carries `tenantId`; the extension auto-scopes it and forbids `findUnique`).
- Add the back-relation `consentRecords ConsentRecord[]` to `Tenant` and `User`.
- Migration: `npm run db:migrate -- --name add_consent_records` on dev, then
  `npm run db:migrate:deploy:prod` (DIRECT_URL/5432) as the pipeline test.

## Legal content

1. **New page** `src/app/(legal)/contrato-de-subcontratacao/page.tsx`, built with the
   existing `LegalPage`/`LegalSection` components (mirror `termos-e-condicoes/page.tsx`).
   Draft PT-PT content covering Art. 28(3): objeto e duração; natureza e finalidade;
   tipo de dados pessoais e categorias de titulares; instruções documentadas;
   confidencialidade; medidas de segurança (Art. 32); subcontratantes autorizados
   (Supabase, Vercel, Resend, PostHog, Sentry) e transferências para fora do EEE (CCP/SCC);
   assistência ao responsável (direitos dos titulares, violações, AIPD); eliminação/
   devolução no fim; auditorias. **Draft ships with a visible "carece de revisão jurídica"
   note** and is linked from the footer + sitemap like the other legal pages.
2. **Edit Terms §9** (`termos-e-condicoes/page.tsx`): replace the "mediante pedido"
   sentence with a link to `/contrato-de-subcontratacao` and text making it integral:
   "O Contrato de Subcontratação (DPA) … faz parte integrante destes Termos e é aceite
   com eles." Bump the Terms `lastUpdated`.
3. **`LEGAL_VERSIONS` constant** (`src/lib/legal.ts`): `{ terms, privacy, dpa }` string
   dates. Single source of truth; the legal pages and the consent logic both read it.

## API — `consent` tRPC router

`src/server/routers/consent.ts`, merged into `_app.ts`. Both procedures `protectedProcedure`.

- **`consent.status`** (query) → `{ needsUserTerms: boolean, needsControllerDpa: boolean }`
  - `needsUserTerms`: true when no `USER_TERMS` record exists for `ctx.user.id` whose
    `documentVersions.terms === LEGAL_VERSIONS.terms` and `.privacy === LEGAL_VERSIONS.privacy`.
  - `needsControllerDpa`: true only when `ctx.user.role === "ADMIN"` and no
    `CONTROLLER_DPA` record exists for the tenant whose `documentVersions.dpa/terms` match current.
- **`consent.accept`** (mutation), input `{ type: ConsentType }`
  - Reads accepting user's name/email from `ctx.user`; captures IP from request headers
    (`x-forwarded-for`, exposed via tRPC context).
  - `USER_TERMS` → one record snapshotting `{terms, privacy}`.
  - `CONTROLLER_DPA` (ADMIN only; else `FORBIDDEN`) → in one transaction, writes a
    `CONTROLLER_DPA` record snapshotting `{terms, dpa}` **and** a `USER_TERMS` record for
    the same admin (so the admin is never prompted twice).
  - Version snapshots always taken from `LEGAL_VERSIONS` server-side (never trusted from client).
- IP capture: extend `createTRPCContext` to expose the request IP; `consent.accept` reads it.

## Flow — one-time blocking gate

Server-side check in the dashboard layout (`src/app/(dashboard)/layout.tsx`) via the
existing SSR path, hydrated to a small client gate component:

- On entry, call `consent.status`.
- If `needsControllerDpa` → show the **controller** interstitial: "Aceitar Termos e
  Contrato de Subcontratação (RGPD)", with links to both docs; accept → `consent.accept({type:"CONTROLLER_DPA"})`.
- Else if `needsUserTerms` → show the **user** interstitial: "Aceitar Termos e Política
  de Privacidade"; accept → `consent.accept({type:"USER_TERMS"})`.
- The gate blocks dashboard interaction until accepted (a one-time action). Logout remains
  available. Component lives in `src/app/(dashboard)/_components/consent-gate.tsx`.
- All copy via `next-intl` keys in `messages/pt-PT.json` (PT-PT only).

## Testing

- **Unit** (`tests/consent-status.test.ts`): version-comparison logic — needs-acceptance
  when no record / stale version / satisfied when versions match; `needsControllerDpa`
  gated to ADMIN.
- **Integration** (`tests/consent.test.ts`, uses the two-tenant helper): `consent.accept`
  writes the right record(s) (CONTROLLER_DPA also writes admin USER_TERMS); a non-admin
  calling CONTROLLER_DPA gets `FORBIDDEN`; `ConsentRecord` is tenant-scoped (cross-tenant
  records never leak) — extends the existing isolation suite.
- **E2E** (later): first-login gate appears and clears after acceptance.

## Rollout / migration-pipeline test

1. `npm run db:migrate -- --name add_consent_records` (dev).
2. Commit schema + migration folder together.
3. `npm run db:migrate:deploy:prod` (DIRECT_URL/5432 → the app's instance `c476`).
4. Verify: `npm run db:migrate:status:prod` shows it applied; the live app's next admin
   login shows the gate. This is the end-to-end proof that automated migrations reach the
   DB the app uses — the workstream-A follow-up.

## Open decisions

- **C-D1:** exact `LEGAL_VERSIONS.dpa` value / Terms `lastUpdated` bump date — set when the
  DPA draft is finalised.
- **C-D2 (legal, not code):** the DPA clause wording + confirming the sub-processor list is
  complete and transfer mechanism (SCCs) is correctly stated — needs legal review before go-live.

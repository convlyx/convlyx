# Consent & DPA Recording — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record versioned, timestamped acceptance of the Terms + DPA (school/controller, RGPD Art. 28) and Terms + Privacy (each user), publish a real DPA document incorporated into the Terms, and use its single additive migration as the first live test of the trusted `db:migrate:deploy:prod` pipeline.

**Architecture:** One additive Prisma model (`ConsentRecord`, tenant-scoped) + a `consent` tRPC router (`status` / `accept`) + a one-time blocking gate in the dashboard layout + a new DPA legal page and a Terms §9 edit. A `LEGAL_VERSIONS` constant is the single source of truth for document versions; acceptance records snapshot it.

**Tech Stack:** Prisma 7 + Postgres (Supabase), tRPC v11, Next.js 15 App Router, next-intl (pt-PT), `@base-ui/react` UI primitives, Vitest.

**Design spec:** `docs/superpowers/specs/2026-07-01-consent-and-dpa-recording-design.md`.

## Global Constraints

- **NO git commits** (project owner's standing rule). Implementers create/verify only; the "Commit" steps are for whoever integrates — provide the message, do not run `git commit`.
- **PT-PT only, all user-facing strings via `next-intl` keys** in `messages/pt-PT.json` — zero hardcoded UI text. Use European Portuguese ("condução", "palavra-passe", never PT-BR).
- **Package manager is pnpm**, never npm.
- **Migrations:** `pnpm db:migrate -- --name <name>` on dev; `pnpm db:migrate:deploy:prod` for prod (trusted, uses DIRECT_URL/5432 — see `docs/decisions/2026-06-24-prod-db-routing-investigation.md`). Never `prisma db push`. Never run local prod scripts via the 6543 pooler.
- **Tenant-scoped models:** every query goes through `ctx.db` (auto-injects `tenantId`); use `findFirst` with `tenantId`, never `findUnique`, on tenant-scoped models.
- **UI:** theme tokens only (no raw palette literals); `Card` primitive for surfaces; `rounded-xl` for cards. Semantic HTML, labelled controls, keyboard-accessible.
- **The DPA document ships flagged "carece de revisão jurídica"** — it is a draft pending legal sign-off, not final legal text.

---

## Task 1: `ConsentRecord` schema + migration

**Files:**
- Modify: `prisma/schema.prisma` (add enum + model + back-relations)
- Modify: `src/server/lib/tenant-scope.ts:41-50` (add model to scoped set)
- Modify: `tests/helpers/tenant.ts:144-157` (delete consent rows in cleanup)

**Interfaces:**
- Produces: Prisma model `ConsentRecord` and enum `ConsentType { CONTROLLER_DPA, USER_TERMS }`, accessible as `db.consentRecord`. Fields: `id`, `tenantId`, `userId?`, `type`, `documentVersions` (Json), `acceptedByEmail`, `acceptedByName`, `ipAddress?`, `acceptedAt`.

- [ ] **Step 1: Add the enum + model to `prisma/schema.prisma`**

After the `CourseStatus`/`ExamResult` enums block, add:

```prisma
enum ConsentType {
  CONTROLLER_DPA
  USER_TERMS
}
```

Before `// Platform-admin audit trail` (the `AuditLog` comment), add:

```prisma
model ConsentRecord {
  id               String      @id @default(uuid()) @db.Uuid
  tenantId         String      @map("tenant_id") @db.Uuid
  // Nullable + SetNull: a consent log must stay legible even if the person is
  // later deleted/anonymised. The email/name snapshots preserve who accepted.
  userId           String?     @map("user_id") @db.Uuid
  type             ConsentType
  // Snapshot of accepted document versions, e.g.
  // {"terms":"2026-07-01","dpa":"2026-07-01"} or {"terms":"...","privacy":"..."}.
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

- [ ] **Step 2: Add back-relations**

In `model Tenant` (after `users   User[]`), add:
```prisma
  consentRecords ConsentRecord[]
```
In `model User` (after `pushSubscriptions PushSubscription[]`), add:
```prisma
  consentRecords ConsentRecord[]
```

- [ ] **Step 3: Register the model in the tenant-scope extension**

In `src/server/lib/tenant-scope.ts`, add `"ConsentRecord"` to the `TENANT_SCOPED_MODELS` set (alphabetical-ish, next to the others):

```ts
const TENANT_SCOPED_MODELS = new Set<string>([
  "School",
  "User",
  "ClassSession",
  "Enrollment",
  "Notification",
  "StudentCourse",
  "Exam",
  "PushSubscription",
  "ConsentRecord",
]);
```

- [ ] **Step 4: Fix the test cleanup helper (FK-safe order)**

In `tests/helpers/tenant.ts`, inside `cleanupTenants`'s `$transaction` array, add a consent delete **before** the `user`/`school`/`tenant` deletes:

```ts
    db.consentRecord.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    db.user.deleteMany({ where: { tenantId: { in: tenantIds } } }),
```
(Insert the first line immediately above the existing `db.user.deleteMany(...)` line.)

- [ ] **Step 5: Generate the migration on dev**

Run:
```bash
pnpm db:migrate -- --name add_consent_records
```
Expected: a new folder `prisma/migrations/<timestamp>_add_consent_records/` containing a `migration.sql` that `CREATE TYPE "ConsentType"` and `CREATE TABLE "consent_records"` with the three indexes and two FKs; Prisma applies it to the dev DB and regenerates the client.

- [ ] **Step 6: Verify it compiles**

Run:
```bash
pnpm db:generate && pnpm type-check
```
Expected: both succeed with no errors (`db.consentRecord` now exists on the client).

- [ ] **Step 7: Commit** (message below — do NOT run git commit; hand off the message)

```
feat(consent): add ConsentRecord table + migration

Additive tenant-scoped table recording Terms/DPA/Privacy acceptance.
Registered in the tenant-scope extension; test cleanup updated for the
new FK. No backfill — consent is actively given.
```

---

## Task 2: Legal content — versions constant, DPA page, Terms §9

**Files:**
- Create: `src/lib/legal.ts`
- Create: `src/app/(legal)/contrato-de-subcontratacao/page.tsx`
- Modify: `src/app/(legal)/termos-e-condicoes/page.tsx` (§9 + `lastUpdated`)
- Modify: `src/app/(legal)/politica-de-privacidade/page.tsx` (render `lastUpdated` from constant)
- Modify: `src/app/(legal)/termos-e-condicoes/page.tsx` + `politica-de-privacidade/page.tsx` (use `LEGAL_VERSIONS`)
- Modify: `src/app/no-tenant/_components/site-footer.tsx` (add DPA link)
- Modify: `src/app/sitemap.ts` (add DPA URL)

**Interfaces:**
- Produces: `LEGAL_VERSIONS` from `@/lib/legal` — `{ terms: string; privacy: string; dpa: string }` (ISO date strings). Consumed by Task 3's consent logic and by the legal pages' `lastUpdated`.
- Produces: route `/contrato-de-subcontratacao`.

- [ ] **Step 1: Create the versions constant**

First read the current `lastUpdated` in `src/app/(legal)/politica-de-privacidade/page.tsx` and use that exact value for `privacy` below (don't change the privacy page's displayed date — its content isn't changing). Create `src/lib/legal.ts`:

```ts
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
```

- [ ] **Step 2: Create the DPA page (draft, flagged for legal review)**

Create `src/app/(legal)/contrato-de-subcontratacao/page.tsx`, mirroring `termos-e-condicoes/page.tsx`'s structure. Use `LEGAL_VERSIONS.dpa` for `lastUpdated`. Content (PT-PT draft — reproduce verbatim):

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection as Section } from "../_components/legal-page";
import { COMPANY, formatLegalEntity } from "@/lib/company";
import { LEGAL_VERSIONS } from "@/lib/legal";

const URL = "https://convlyx.com/contrato-de-subcontratacao";
const TITLE = "Contrato de Subcontratação (DPA) | Convlyx";
const DESCRIPTION =
  "Contrato de subcontratação de tratamento de dados pessoais (Art. 28.º RGPD) entre a escola de condução (responsável) e o Convlyx (subcontratante).";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
};

export default function Page() {
  return (
    <LegalPage title="Contrato de Subcontratação (DPA)" lastUpdated={LEGAL_VERSIONS.dpa}>
      <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-foreground/80">
        Este documento é uma minuta e <strong>carece de revisão jurídica</strong> antes
        de ser considerado definitivo.
      </div>

      <Section title="1. Enquadramento e definições">
        <p>
          O presente Contrato de Subcontratação (&quot;DPA&quot;) regula o tratamento de
          dados pessoais efetuado por <strong>{formatLegalEntity()}</strong> (&quot;Convlyx&quot;,
          o subcontratante) por conta da escola de condução Cliente (o responsável pelo
          tratamento), ao abrigo do artigo 28.º do Regulamento (UE) 2016/679 (RGPD) e da
          Lei n.º 58/2019. Faz parte integrante dos{" "}
          <Link href="/termos-e-condicoes" className="text-primary hover:underline">
            Termos e Condições
          </Link>{" "}
          e é aceite com eles.
        </p>
      </Section>

      <Section title="2. Objeto, duração, natureza e finalidade">
        <p>
          O Convlyx trata dados pessoais exclusivamente para prestar o serviço de gestão
          da escola de condução (agenda de aulas, alunos, instrutores, exames, presenças,
          notificações). O tratamento dura enquanto vigorar o contrato de prestação de
          serviço e cessa nos termos da cláusula 9.
        </p>
      </Section>

      <Section title="3. Tipos de dados e categorias de titulares">
        <p>
          Dados de identificação e contacto (nome, email, telefone), dados de percurso
          formativo (aulas, presenças, exames, categorias de carta) e dados de conta.
          Titulares: alunos, instrutores e colaboradores da escola Cliente.
        </p>
      </Section>

      <Section title="4. Instruções documentadas">
        <p>
          O Convlyx trata os dados apenas de acordo com instruções documentadas do
          responsável, incluindo as constantes destes documentos, salvo obrigação legal
          da União ou de Portugal.
        </p>
      </Section>

      <Section title="5. Confidencialidade">
        <p>
          As pessoas autorizadas a tratar os dados estão sujeitas a dever de
          confidencialidade.
        </p>
      </Section>

      <Section title="6. Segurança (Art. 32.º)">
        <p>
          O Convlyx aplica medidas técnicas e organizativas adequadas: isolamento de
          dados por escola (multi-tenant), encriptação em trânsito e em repouso, controlo
          de acessos por função, registo de auditoria e alojamento em infraestrutura
          europeia.
        </p>
      </Section>

      <Section title="7. Subcontratantes autorizados">
        <p>O Cliente autoriza os seguintes subcontratantes ulteriores:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Supabase</strong> — base de dados e autenticação (alojamento na UE, eu-west-1).</li>
          <li><strong>Vercel</strong> — alojamento e execução da aplicação (região de Dublin).</li>
          <li><strong>Resend</strong> — envio de emails transacionais.</li>
          <li><strong>PostHog</strong> — analítica de produto (instância UE).</li>
          <li><strong>Sentry</strong> — monitorização de erros.</li>
        </ul>
        <p>
          O Convlyx informa o Cliente de alterações à lista com antecedência razoável,
          permitindo oposição fundamentada.
        </p>
      </Section>

      <Section title="8. Transferências internacionais">
        <p>
          Quando um subcontratante implique tratamento fora do Espaço Económico Europeu,
          a transferência é enquadrada por garantias adequadas nos termos do Capítulo V do
          RGPD, designadamente Cláusulas Contratuais-Tipo (CCP/SCC).
        </p>
      </Section>

      <Section title="9. Assistência ao responsável">
        <p>
          O Convlyx assiste o Cliente no cumprimento dos pedidos de exercício de direitos
          dos titulares, na notificação de violações de dados e na realização de
          avaliações de impacto, na medida da sua função como subcontratante.
        </p>
      </Section>

      <Section title="10. Eliminação ou devolução">
        <p>
          Cessado o serviço, os dados do Cliente ficam disponíveis para exportação durante
          30 dias, sendo depois eliminados, sem prejuízo de prazos legais de conservação.
        </p>
      </Section>

      <Section title="11. Auditorias">
        <p>
          O Convlyx disponibiliza a informação necessária para demonstrar o cumprimento do
          artigo 28.º e permite auditorias razoáveis, com pré-aviso, mediante acordo.
        </p>
      </Section>

      <Section title="12. Contacto">
        <p>
          Questões sobre este DPA:{" "}
          <a href={`mailto:${COMPANY.contactEmail}`} className="text-primary hover:underline">
            {COMPANY.contactEmail}
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
```

- [ ] **Step 3: Rewrite Terms §9 to incorporate the DPA**

In `src/app/(legal)/termos-e-condicoes/page.tsx`, replace the second `<p>` of the §9 section (the "Mediante pedido … disponibilizamos um Contrato de Subcontratação (DPA)" paragraph) with:

```tsx
        <p>
          O{" "}
          <Link href="/contrato-de-subcontratacao" className="text-primary hover:underline">
            Contrato de Subcontratação (DPA)
          </Link>{" "}
          regula esse tratamento — incluindo a lista de subcontratantes autorizados, as
          transferências internacionais e o regime de notificação de incidentes — e{" "}
          <strong>faz parte integrante destes Termos, sendo aceite com eles</strong>.
        </p>
```
Ensure `Link` is imported (it already is). Then change the page's `lastUpdated="2026-06-04"` to `lastUpdated={LEGAL_VERSIONS.terms}` and add `import { LEGAL_VERSIONS } from "@/lib/legal";`.

- [ ] **Step 4: Point the privacy page's date at the constant**

In `src/app/(legal)/politica-de-privacidade/page.tsx`, add `import { LEGAL_VERSIONS } from "@/lib/legal";` and change its `lastUpdated={...}` prop to `lastUpdated={LEGAL_VERSIONS.privacy}` (value already matched in Step 1).

- [ ] **Step 5: Link the DPA from the footer and sitemap**

In `src/app/no-tenant/_components/site-footer.tsx`, add a link to `/contrato-de-subcontratacao` labelled `Contrato de Subcontratação` alongside the existing legal links (match their markup). In `src/app/sitemap.ts`, add an entry for `${base}/contrato-de-subcontratacao` mirroring the other legal-page entries.

- [ ] **Step 6: Verify**

Run:
```bash
pnpm lint && pnpm type-check
```
Expected: both pass. Then `pnpm dev` and load `http://localhost:3000/contrato-de-subcontratacao` and `/termos-e-condicoes` — DPA page renders with the review banner; Terms §9 links to it.

- [ ] **Step 7: Commit** (message; do not run git commit)

```
feat(legal): add DPA page + incorporate it into the Terms

New /contrato-de-subcontratacao (Art. 28 draft, flagged for legal review)
with sub-processor list + EEA-transfer clause. Terms §9 now links it and
declares it integral. LEGAL_VERSIONS constant is the single source of
document versions.
```

---

## Task 3: `consent` router + version logic + context IP

**Files:**
- Create: `src/lib/consent.ts` (pure version-comparison helpers)
- Test: `tests/consent-status.test.ts` (unit)
- Create: `src/server/routers/consent.ts`
- Modify: `src/server/routers/_app.ts` (merge router)
- Modify: `src/server/trpc.ts` (add `ip` to context)
- Test: `tests/consent.test.ts` (integration)

**Interfaces:**
- Consumes: `LEGAL_VERSIONS` (Task 2); `ConsentRecord`/`ConsentType` (Task 1); `TestTenant`/`createTestTenant`/`cleanupTenants` (`tests/helpers/tenant.ts`).
- Produces: `userTermsSatisfied(v)` and `controllerDpaSatisfied(v)` from `@/lib/consent` (both `(v: StoredVersions | null) => boolean`, where `StoredVersions = { terms?: string; privacy?: string; dpa?: string }`).
- Produces: `consentRouter` with `status` (query → `{ needsUserTerms: boolean; needsControllerDpa: boolean }`) and `accept` (mutation, input `{ type: "CONTROLLER_DPA" | "USER_TERMS" }` → `{ success: true }`).
- Produces: `ctx.ip: string | null` on `TRPCContext`.

- [ ] **Step 1: Write the failing unit test for the pure helpers**

Create `tests/consent-status.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { userTermsSatisfied, controllerDpaSatisfied } from "@/lib/consent";
import { LEGAL_VERSIONS } from "@/lib/legal";

describe("consent version logic", () => {
  it("userTerms: null record is not satisfied", () => {
    expect(userTermsSatisfied(null)).toBe(false);
  });
  it("userTerms: matching terms+privacy is satisfied", () => {
    expect(
      userTermsSatisfied({ terms: LEGAL_VERSIONS.terms, privacy: LEGAL_VERSIONS.privacy }),
    ).toBe(true);
  });
  it("userTerms: stale terms is not satisfied", () => {
    expect(
      userTermsSatisfied({ terms: "1999-01-01", privacy: LEGAL_VERSIONS.privacy }),
    ).toBe(false);
  });
  it("controllerDpa: matching terms+dpa is satisfied", () => {
    expect(
      controllerDpaSatisfied({ terms: LEGAL_VERSIONS.terms, dpa: LEGAL_VERSIONS.dpa }),
    ).toBe(true);
  });
  it("controllerDpa: stale dpa is not satisfied", () => {
    expect(
      controllerDpaSatisfied({ terms: LEGAL_VERSIONS.terms, dpa: "1999-01-01" }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm vitest run tests/consent-status.test.ts`
Expected: FAIL — `@/lib/consent` does not exist.

- [ ] **Step 3: Implement the pure helpers**

Create `src/lib/consent.ts`:

```ts
import { LEGAL_VERSIONS } from "./legal";

/** The version snapshot stored in ConsentRecord.documentVersions. */
export type StoredVersions = { terms?: string; privacy?: string; dpa?: string };

/** A USER_TERMS record satisfies current requirements iff both terms+privacy match. */
export function userTermsSatisfied(v: StoredVersions | null): boolean {
  if (!v) return false;
  return v.terms === LEGAL_VERSIONS.terms && v.privacy === LEGAL_VERSIONS.privacy;
}

/** A CONTROLLER_DPA record satisfies current requirements iff both terms+dpa match. */
export function controllerDpaSatisfied(v: StoredVersions | null): boolean {
  if (!v) return false;
  return v.terms === LEGAL_VERSIONS.terms && v.dpa === LEGAL_VERSIONS.dpa;
}
```

- [ ] **Step 4: Run the unit test to confirm it passes**

Run: `pnpm vitest run tests/consent-status.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Add `ip` to the tRPC context**

In `src/server/trpc.ts`: add `ip: string | null;` to the `TRPCContext` type (after `tenantId`). In `createTRPCContext`, compute it once near the top and include it in **both** return objects:

```ts
  const ip = opts.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
```
Return `{ db, tenantId: null, user: null, ip }` in the unauthenticated branches and `{ db, tenantId: user.tenantId, user: {...}, ip }` in the success branch. (`protectedProcedure` already spreads `...ctx`, so `ip` flows through.)

- [ ] **Step 6: Write the failing integration test for the router**

Create `tests/consent.test.ts`:

```ts
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/server/db";
import { createCallerFactory } from "@/server/trpc";
import { appRouter } from "@/server/routers/_app";
import { createTestTenant, cleanupTenants, type TestTenant } from "./helpers/tenant";
import { LEGAL_VERSIONS } from "@/lib/legal";

const createCaller = createCallerFactory(appRouter);
let A: TestTenant;

afterAll(async () => {
  if (A) await cleanupTenants(A.tenantId);
});

describe("consent router", () => {
  it("fresh admin needs both DPA and user terms", async () => {
    A = await createTestTenant("consent");
    const status = await A.asAdmin.consent.status();
    expect(status.needsControllerDpa).toBe(true);
    expect(status.needsUserTerms).toBe(true);
  });

  it("admin CONTROLLER_DPA accept clears both (writes DPA + own USER_TERMS)", async () => {
    await A.asAdmin.consent.accept({ type: "CONTROLLER_DPA" });
    const status = await A.asAdmin.consent.status();
    expect(status.needsControllerDpa).toBe(false);
    expect(status.needsUserTerms).toBe(false);

    const rows = await db.consentRecord.findMany({ where: { tenantId: A.tenantId } });
    expect(rows.map((r) => r.type).sort()).toEqual(["CONTROLLER_DPA", "USER_TERMS"]);
    const dpa = rows.find((r) => r.type === "CONTROLLER_DPA")!;
    expect((dpa.documentVersions as { dpa?: string }).dpa).toBe(LEGAL_VERSIONS.dpa);
  });

  it("a student cannot accept CONTROLLER_DPA (FORBIDDEN) but can accept USER_TERMS", async () => {
    const asStudent = createCaller({
      db,
      tenantId: A.tenantId,
      ip: null,
      user: { id: A.studentUserId, role: "STUDENT", tenantId: A.tenantId, schoolId: A.schoolId },
    });
    await expect(asStudent.consent.accept({ type: "CONTROLLER_DPA" })).rejects.toThrow();
    await asStudent.consent.accept({ type: "USER_TERMS" });
    const status = await asStudent.consent.status();
    expect(status.needsUserTerms).toBe(false);
    expect(status.needsControllerDpa).toBe(false); // students never need the DPA
  });
});
```

- [ ] **Step 7: Run it to confirm it fails**

Run: `pnpm vitest run tests/consent.test.ts`
Expected: FAIL — `consent` router does not exist on the caller.

- [ ] **Step 8: Implement the router**

Create `src/server/routers/consent.ts`:

```ts
import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { LEGAL_VERSIONS } from "@/lib/legal";
import {
  userTermsSatisfied,
  controllerDpaSatisfied,
  type StoredVersions,
} from "@/lib/consent";

// Latest record of a given type for a where-clause, newest first.
async function latest(
  db: (typeof import("../trpc"))["protectedProcedure"] extends never ? never : any,
) {
  return db; // placeholder — replaced below
}

export const consentRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const [userRec, dpaRec] = await Promise.all([
      ctx.db.consentRecord.findFirst({
        where: { tenantId: ctx.tenantId, userId: ctx.user.id, type: "USER_TERMS" },
        orderBy: { acceptedAt: "desc" },
        select: { documentVersions: true },
      }),
      ctx.user.role === "ADMIN"
        ? ctx.db.consentRecord.findFirst({
            where: { tenantId: ctx.tenantId, type: "CONTROLLER_DPA" },
            orderBy: { acceptedAt: "desc" },
            select: { documentVersions: true },
          })
        : Promise.resolve(null),
    ]);

    return {
      needsUserTerms: !userTermsSatisfied(
        (userRec?.documentVersions as StoredVersions) ?? null,
      ),
      needsControllerDpa:
        ctx.user.role === "ADMIN" &&
        !controllerDpaSatisfied((dpaRec?.documentVersions as StoredVersions) ?? null),
    };
  }),

  accept: protectedProcedure
    .input(z.object({ type: z.enum(["CONTROLLER_DPA", "USER_TERMS"]) }))
    .mutation(async ({ ctx, input }) => {
      if (input.type === "CONTROLLER_DPA" && ctx.user.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "auth.insufficientPermissions",
        });
      }

      // Snapshot who accepted (ctx.user has no name/email — look them up).
      const me = await ctx.db.user.findFirst({
        where: { id: ctx.user.id, tenantId: ctx.tenantId },
        select: { name: true, email: true },
      });
      if (!me) {
        throw new TRPCError({ code: "NOT_FOUND", message: "users.notFound" });
      }

      const base = {
        userId: ctx.user.id,
        acceptedByEmail: me.email,
        acceptedByName: me.name,
        ipAddress: ctx.ip,
      };

      if (input.type === "USER_TERMS") {
        await ctx.db.consentRecord.create({
          data: {
            ...base,
            type: "USER_TERMS",
            documentVersions: { terms: LEGAL_VERSIONS.terms, privacy: LEGAL_VERSIONS.privacy },
          },
        });
        return { success: true as const };
      }

      // CONTROLLER_DPA: record the controller acceptance AND the admin's own
      // user-terms acceptance so they are never prompted twice.
      await ctx.db.$transaction([
        ctx.db.consentRecord.create({
          data: {
            ...base,
            type: "CONTROLLER_DPA",
            documentVersions: { terms: LEGAL_VERSIONS.terms, dpa: LEGAL_VERSIONS.dpa },
          },
        }),
        ctx.db.consentRecord.create({
          data: {
            ...base,
            type: "USER_TERMS",
            documentVersions: { terms: LEGAL_VERSIONS.terms, privacy: LEGAL_VERSIONS.privacy },
          },
        }),
      ]);
      return { success: true as const };
    }),
});
```
Delete the stray `latest` placeholder above before saving (it was a scaffolding artifact — the final file must not contain it).

- [ ] **Step 9: Merge the router**

In `src/server/routers/_app.ts`, import and register:
```ts
import { consentRouter } from "./consent";
```
and add `consent: consentRouter,` to the `appRouter` object.

- [ ] **Step 10: Run the tests to confirm they pass**

Run: `pnpm vitest run tests/consent.test.ts tests/consent-status.test.ts`
Expected: PASS (3 integration + 5 unit).

- [ ] **Step 11: Full check**

Run: `pnpm lint && pnpm type-check`
Expected: both pass.

- [ ] **Step 12: Commit** (message; do not run git commit)

```
feat(consent): add consent tRPC router + version logic

status/accept procedures with server-side version snapshots; admin DPA
acceptance also records the admin's user terms. Added request IP to the
tRPC context. Unit + integration tests (incl. tenant isolation + FORBIDDEN).
```

---

## Task 4: First-login consent gate (UI)

**Files:**
- Create: `src/app/(dashboard)/_components/consent-gate.tsx`
- Modify: `src/app/(dashboard)/layout.tsx` (mount the gate — TWO places)
- Modify: `messages/pt-PT.json` (add `consent` namespace)

**Interfaces:**
- Consumes: `trpc.consent.status` / `trpc.consent.accept` (Task 3).

- [ ] **Step 1: Add i18n keys**

In `messages/pt-PT.json`, add a top-level `"consent"` block (place it near other feature blocks, valid JSON):

```json
  "consent": {
    "userTitle": "Termos e Política de Privacidade",
    "userBody": "Para continuar, confirme que leu e aceita os nossos Termos e Condições e a Política de Privacidade.",
    "controllerTitle": "Termos e Contrato de Subcontratação (RGPD)",
    "controllerBody": "Como responsável pela escola, confirme que leu e aceita os Termos e Condições e o Contrato de Subcontratação (DPA), que regula o tratamento de dados dos seus alunos e colaboradores.",
    "terms": "Termos e Condições",
    "privacy": "Política de Privacidade",
    "dpa": "Contrato de Subcontratação (DPA)",
    "accept": "Aceitar e continuar",
    "accepting": "A registar...",
    "error": "Não foi possível registar a aceitação. Tente novamente."
  }
```

- [ ] **Step 2: Create the gate component**

Create `src/app/(dashboard)/_components/consent-gate.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";

/**
 * One-time blocking gate. Renders a full-screen overlay when the current user
 * still needs to accept documents. Admins with no controller DPA see the DPA
 * variant (which records both controller + their user terms); everyone else
 * sees the user-terms variant. Nothing renders once acceptance is satisfied.
 */
export function ConsentGate() {
  const t = useTranslations("consent");
  const utils = trpc.useUtils();
  const { data } = trpc.consent.status.useQuery(undefined, { staleTime: Infinity });
  const accept = trpc.consent.accept.useMutation({
    onSuccess: async () => {
      await utils.consent.status.invalidate();
    },
    onError: () => toast.error(t("error")),
  });

  if (!data) return null;
  const kind = data.needsControllerDpa ? "controller" : data.needsUserTerms ? "user" : null;
  if (!kind) return null;

  const type = kind === "controller" ? "CONTROLLER_DPA" : "USER_TERMS";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg space-y-4">
        <h2 id="consent-title" className="text-lg font-semibold">
          {kind === "controller" ? t("controllerTitle") : t("userTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {kind === "controller" ? t("controllerBody") : t("userBody")}
        </p>
        <ul className="text-sm space-y-1">
          <li>
            <Link href="/termos-e-condicoes" target="_blank" className="text-primary hover:underline">
              {t("terms")}
            </Link>
          </li>
          {kind === "controller" ? (
            <li>
              <Link href="/contrato-de-subcontratacao" target="_blank" className="text-primary hover:underline">
                {t("dpa")}
              </Link>
            </li>
          ) : (
            <li>
              <Link href="/politica-de-privacidade" target="_blank" className="text-primary hover:underline">
                {t("privacy")}
              </Link>
            </li>
          )}
        </ul>
        <Button
          className="w-full"
          disabled={accept.isPending}
          onClick={() => accept.mutate({ type })}
        >
          {accept.isPending ? t("accepting") : t("accept")}
        </Button>
      </div>
    </div>
  );
}
```
Note: confirm the tRPC client import path matches the project (`@/lib/trpc/client` or similar — check an existing client component that uses `trpc.*.useQuery`, e.g. a component under `src/app/(dashboard)/.../_components/`, and match it). Confirm `Button` lives at `@/components/ui/button`.

- [ ] **Step 3: Mount the gate in the dashboard layout (both branches)**

In `src/app/(dashboard)/layout.tsx`: import it —
```tsx
import { ConsentGate } from "./_components/consent-gate";
```
Add `<ConsentGate />` inside the shared `content` fragment (e.g. right after `<AnalyticsIdentifier {...analyticsProps} />`) — this covers the STUDENT and INSTRUCTOR shells which render `{content}`. **Also** add `<ConsentGate />` inside the admin/secretary `<main>` block (which does not use `content`), next to its own `<AnalyticsIdentifier {...analyticsProps} />`.

- [ ] **Step 4: Verify**

Run:
```bash
pnpm lint && pnpm type-check
```
Expected: both pass. Then `pnpm dev`, log in as the seeded admin on `demo.localhost:3000` → the DPA gate appears; accept → it disappears and does not return on reload. Log in as a student → user-terms gate; accept → clears.

- [ ] **Step 5: Commit** (message; do not run git commit)

```
feat(consent): first-login acceptance gate

Blocking one-time gate in the dashboard layout: admins accept Terms+DPA,
other users accept Terms+Privacy. Mounted in both layout branches. PT-PT
strings via next-intl.
```

---

## Task 5: Ship the migration to prod (pipeline test)

**Files:** none (operational).

**Interfaces:** consumes the migration folder from Task 1.

> This is the workstream-A follow-up: the first automated migration through the trusted path. Run only after Tasks 1–4 are committed and the branch is merged/deployed.

- [ ] **Step 1 [operator]: Confirm migration state before**

Run: `pnpm db:migrate:status:prod`
Expected: lists `add_consent_records` as **pending** on prod (uses DIRECT_URL/5432 → the app's instance).

- [ ] **Step 2 [operator]: Apply to prod**

Run: `pnpm db:migrate:deploy:prod`
Expected: applies `add_consent_records`; reports success. (Uses `DIRECT_URL`/5432, the trusted path — NOT the 6543 pooler.)

- [ ] **Step 3 [operator]: Verify applied**

Run: `pnpm db:migrate:status:prod`
Expected: `add_consent_records` now shows applied; no pending migrations.

- [ ] **Step 4 [operator]: Verify against the live app**

Log into the live app as a school admin → the DPA consent gate appears (proving the `consent_records` table exists on the instance the app reads). Accept it → it clears and does not reappear.

- [ ] **Step 5: Record the outcome**

Append a line to `docs/decisions/2026-06-24-prod-db-routing-investigation.md` noting that `add_consent_records` was applied to prod via `db:migrate:deploy:prod` with no manual dashboard step — the automated-pipeline confirmation. (Message for the commit, do not run git commit.)

---

## Self-Review

- **Spec coverage:** DPA doc (Task 2) ✓; Terms §9 incorporation (Task 2) ✓; sub-processor list + EEA transfer (Task 2 DPA content) ✓; `ConsentRecord` additive table + tenant-scope + no backfill (Task 1) ✓; both controller + per-user acceptance, admin double-write (Task 3) ✓; `LEGAL_VERSIONS` single source (Task 2) ✓; `status`/`accept` + IP capture (Task 3) ✓; blocking gate both roles/both layout branches (Task 4) ✓; unit + integration tests incl. tenant-scoping + FORBIDDEN (Task 3) ✓; pipeline-test rollout (Task 5) ✓. Cookie consent + per-membership explicitly out of scope (spec non-goals) — no tasks, correct.
- **Placeholder scan:** the only "TODO-ish" item is the deliberate `carece de revisão jurídica` banner (a required product flag, not a plan gap) and the Step-1 instruction to copy the privacy date verbatim (a concrete read, not a placeholder). The Task-3 `latest` scaffolding stub is explicitly deleted in Step 8.
- **Type consistency:** `StoredVersions`, `userTermsSatisfied`/`controllerDpaSatisfied`, `ConsentType` values (`"CONTROLLER_DPA"`/`"USER_TERMS"`), `{ needsUserTerms, needsControllerDpa }`, and `ctx.ip` are used identically across Tasks 1, 3, and 4.
- **Unverified project specifics to confirm during Task 4:** the tRPC client import path and `Button` path (Step 2 calls this out explicitly).

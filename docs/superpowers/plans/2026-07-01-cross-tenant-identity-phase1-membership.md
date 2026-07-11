# Cross-Tenant Identity — Phase 1 (additive Membership layer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a `Membership` table (per-tenant role/school for a user) alongside the existing `User`, backfill one membership per user, and make authenticated requests resolve role/school from the membership — **without dropping anything or changing email uniqueness**. Fully reversible; delivers the substrate for one-email-many-schools.

**Architecture:** Approach 1a (spec `docs/superpowers/specs/2026-06-24-…-cross-tenant-identity-design.md` §D.4). `User` stays the global identity (`id == auth.users.id`, columns untouched *this phase*). New tenant-scoped `Membership` holds `(userId, tenantId, schoolId, role, status, qualifiedCategories, novidadesSeenAt)`. `protectedProcedure` loads the caller's membership for the current tenant and exposes `ctx.membership`; role checks read `ctx.membership.role`. Downstream FKs stay on `User.id`.

**Tech Stack:** Prisma 7, tRPC v11, Postgres (Supabase), Vitest.

## Global Constraints

- **NO git commits** (owner's rule) — create/verify only; hand over the message. Ignore each task's "Commit" step's git command.
- **Package manager is pnpm**, never npm.
- **This phase is ADDITIVE & non-breaking:** do NOT drop any `User` column, do NOT change `User`'s `@@unique([tenantId, email])`, do NOT touch downstream FKs. Those are Phase 2.
- **Preserve `User.id == auth.users.id`** — unchanged here (no `User` id changes).
- **Migrations:** `migrate dev` is blocked by pre-existing checksum drift — hand-author the `migration.sql` + apply via `prisma db execute` + record in `_prisma_migrations` (the established repo pattern; see `CLAUDE.md` and [[feedback_db_migrations]]). Prod deploy later via `pnpm db:migrate:deploy:prod` (out of scope for this plan).
- **Tenant isolation must hold:** `Membership` is tenant-scoped (added to `TENANT_SCOPED_MODELS`); queries use `findFirst`, never `findUnique`, on scoped models.
- **Backfill is safe:** prod has **0 emails spanning >1 tenant** (verified), so every user maps to exactly one membership — no merge/reconciliation.

---

## Task 1: `Membership` model + backfill migration

**Files:**
- Modify: `prisma/schema.prisma` (add `Membership`, enum reuse, back-relations)
- Create: `prisma/migrations/20260701130000_add_memberships/migration.sql`
- Modify: `src/server/lib/tenant-scope.ts` (add `"Membership"` to `TENANT_SCOPED_MODELS`)
- Modify: `tests/helpers/tenant.ts` (create a membership per seeded user; delete memberships in cleanup)
- Test: `tests/membership.test.ts` (backfill + scoping)

**Interfaces:**
- Produces: Prisma model `Membership` → `db.membership`, fields `id, tenantId, userId, schoolId, role, status, qualifiedCategories, novidadesSeenAt, createdAt, updatedAt`; `@@unique([tenantId, userId])`.

- [ ] **Step 1: Add the model to `prisma/schema.prisma`**

Add after the `ConsentRecord` model (before the `AuditLog` comment):

```prisma
model Membership {
  id                  String            @id @default(uuid()) @db.Uuid
  tenantId            String            @map("tenant_id") @db.Uuid
  userId              String            @map("user_id") @db.Uuid
  schoolId            String            @map("school_id") @db.Uuid
  role                UserRole
  status              UserStatus        @default(ACTIVE)
  qualifiedCategories LicenseCategory[] @default([]) @map("qualified_categories")
  novidadesSeenAt     DateTime?         @map("novidades_seen_at")
  createdAt           DateTime          @default(now()) @map("created_at")
  updatedAt           DateTime          @updatedAt @map("updated_at")

  tenant Tenant @relation(fields: [tenantId], references: [id])
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  school School @relation(fields: [schoolId], references: [id])

  @@unique([tenantId, userId])
  @@index([tenantId])
  @@index([schoolId])
  @@index([userId])
  @@map("memberships")
}
```

Add back-relations: in `model Tenant` add `memberships Membership[]`; in `model User` add `memberships Membership[]`; in `model School` add `memberships Membership[]`.

- [ ] **Step 2: Hand-author the migration** `prisma/migrations/20260701130000_add_memberships/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "qualified_categories" "LicenseCategory"[] DEFAULT ARRAY[]::"LicenseCategory"[],
    "novidades_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "memberships_tenant_id_user_id_key" ON "memberships"("tenant_id", "user_id");
CREATE INDEX "memberships_tenant_id_idx" ON "memberships"("tenant_id");
CREATE INDEX "memberships_school_id_idx" ON "memberships"("school_id");
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: one membership per existing user (mirrors their current tenant/school/role).
INSERT INTO "memberships" (id, tenant_id, user_id, school_id, role, status, qualified_categories, novidades_seen_at, created_at, updated_at)
SELECT gen_random_uuid(), tenant_id, id, school_id, role, status, qualified_categories, novidades_seen_at, now(), now()
FROM "users";
```

- [ ] **Step 3: Register in the tenant-scope extension** — add `"Membership"` to the `TENANT_SCOPED_MODELS` set in `src/server/lib/tenant-scope.ts` (next to `"ConsentRecord"`).

- [ ] **Step 4: Update the test helper** `tests/helpers/tenant.ts`:
  - In `createTestTenant`, after the users are created, create a membership per user (add to the existing `$transaction` array, or a follow-up `createMany`):

```ts
    db.membership.createMany({
      data: [
        { tenantId, userId: adminUserId, schoolId, role: "ADMIN" },
        { tenantId, userId: instructorUserId, schoolId, role: "INSTRUCTOR", qualifiedCategories: ["B"] },
        { tenantId, userId: studentUserId, schoolId, role: "STUDENT" },
      ],
    }),
```
  - In `cleanupTenants`, add `db.membership.deleteMany({ where: { tenantId: { in: tenantIds } } }),` **before** the `db.user.deleteMany(...)` line.

- [ ] **Step 5: Apply on dev + regenerate**

```bash
dotenv -e .env -- prisma db execute --file prisma/migrations/20260701130000_add_memberships/migration.sql --schema prisma/schema.prisma
dotenv -e .env -- tsx -e "import 'dotenv/config'; import pg from 'pg'; (async()=>{const p=new pg.Pool({connectionString:process.env.DIRECT_URL??process.env.DATABASE_URL,max:1}); await p.query(\"INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, applied_steps_count) VALUES (gen_random_uuid()::text,'manual',now(),'20260701130000_add_memberships',1) ON CONFLICT DO NOTHING\"); await p.end();})();"
pnpm db:generate
```
(Run via `pnpm exec` if `dotenv`/`tsx`/`prisma` aren't on PATH: `pnpm exec prisma db execute ...`.)

- [ ] **Step 6: Write the failing test** `tests/membership.test.ts`:

```ts
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/server/db";
import { withTenant } from "@/server/lib/tenant-scope";
import { createTestTenant, cleanupTenants, type TestTenant } from "./helpers/tenant";

let A: TestTenant, B: TestTenant;
afterAll(async () => { if (A) await cleanupTenants(A.tenantId, B.tenantId); });

describe("Membership", () => {
  it("backfill/helper creates one membership per user with the right role", async () => {
    A = await createTestTenant("mem-a");
    B = await createTestTenant("mem-b");
    const rows = await db.membership.findMany({ where: { tenantId: A.tenantId }, orderBy: { role: "asc" } });
    expect(rows.length).toBe(3);
    const admin = rows.find((r) => r.userId === A.adminUserId)!;
    expect(admin.role).toBe("ADMIN");
    expect(admin.schoolId).toBe(A.schoolId);
  });

  it("is tenant-scoped: a scoped client for tenant A never sees tenant B's memberships", async () => {
    const scoped = withTenant(db, A.tenantId);
    const all = await scoped.membership.findMany({});
    expect(all.every((m) => m.tenantId === A.tenantId)).toBe(true);
    expect(all.some((m) => m.userId === B.adminUserId)).toBe(false);
  });
});
```

- [ ] **Step 7: Run tests**

`pnpm vitest run tests/membership.test.ts` → PASS (2). Then `pnpm db:generate && pnpm type-check && pnpm lint` → clean.

- [ ] **Step 8: Commit** — message: `feat(identity): add Membership table + backfill (phase 1)` (do not run git commit).

---

## Task 2: Resolve membership in `protectedProcedure`; role checks read it

**Files:**
- Modify: `src/server/trpc.ts` (`protectedProcedure` loads membership → `ctx.membership`; `roleProtectedProcedure` reads `ctx.membership.role`)
- Test: `tests/membership-context.test.ts`

**Interfaces:**
- Consumes: `db.membership` (Task 1); `createTestTenant` now seeds memberships (Task 1).
- Produces: every `protectedProcedure`/`roleProtectedProcedure` handler gets `ctx.membership: { id: string; role: UserRole; schoolId: string; tenantId: string }`.

- [ ] **Step 1: Rework `protectedProcedure` in `src/server/trpc.ts`** — after building the tenant-scoped `db`, load the caller's membership for the current tenant and inject it:

```ts
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user || !ctx.tenantId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "auth.notAuthenticated" });
  }

  const db = withTenant(ctx.db, ctx.tenantId);

  // Approach 1a: the caller's role/school live on their Membership in THIS tenant.
  // No membership ⇒ not a member of this school ⇒ unauthorized (don't leak existence).
  const membership = await db.membership.findFirst({
    where: { userId: ctx.user.id, tenantId: ctx.tenantId },
    select: { id: true, role: true, schoolId: true, tenantId: true },
  });
  if (!membership) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "auth.notAuthenticated" });
  }

  return next({
    ctx: { ...ctx, user: ctx.user, tenantId: ctx.tenantId, db, membership },
  });
});
```

- [ ] **Step 2: Rework `roleProtectedProcedure`** to check `ctx.membership.role`:

```ts
export const roleProtectedProcedure = (allowedRoles: UserRole[]) =>
  protectedProcedure.use(async ({ ctx, next }) => {
    if (!allowedRoles.includes(ctx.membership.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "auth.insufficientPermissions" });
    }
    return next({ ctx });
  });
```

(`ctx.user.role` etc. remain populated and valid — this phase only ADDS `ctx.membership`; the 40-ref sweep is Phase 2. Router code is unchanged.)

- [ ] **Step 3: Write the failing test** `tests/membership-context.test.ts`:

```ts
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/server/db";
import { createCallerFactory } from "@/server/trpc";
import { appRouter } from "@/server/routers/_app";
import { createTestTenant, cleanupTenants, type TestTenant } from "./helpers/tenant";

const createCaller = createCallerFactory(appRouter);
let A: TestTenant;
afterAll(async () => { if (A) await cleanupTenants(A.tenantId); });

describe("membership-aware protectedProcedure", () => {
  it("a user with no membership in the tenant is rejected", async () => {
    A = await createTestTenant("mem-ctx");
    // Delete the admin's membership → they are no longer a member of this tenant.
    await db.membership.deleteMany({ where: { tenantId: A.tenantId, userId: A.adminUserId } });
    await expect(A.asAdmin.user.list({})).rejects.toThrow();
  });

  it("role checks read membership.role (STUDENT can't call an ADMIN/SECRETARY procedure)", async () => {
    const asStudent = createCaller({
      db,
      tenantId: A.tenantId,
      ip: null,
      user: { id: A.studentUserId, role: "STUDENT", tenantId: A.tenantId, schoolId: A.schoolId },
    });
    // user.list is ADMIN/SECRETARY-only; the student HAS a membership (role STUDENT) → FORBIDDEN, not UNAUTHORIZED.
    await expect(asStudent.user.list({})).rejects.toThrow();
  });
});
```
(Adjust `user.list`'s input `{}` to its actual required shape if the schema demands fields — check `listUsersSchema`; pass the minimal valid input.)

- [ ] **Step 4: Run tests** — `pnpm vitest run tests/membership-context.test.ts` → PASS. Then `pnpm vitest run` (full suite) → all green (the isolation/consent/cross-tenant suites exercise `protectedProcedure`; they pass because `createTestTenant` now seeds memberships).

- [ ] **Step 5:** `pnpm type-check && pnpm lint` → clean.

- [ ] **Step 6: Commit** — `feat(identity): resolve membership in protectedProcedure; role checks via membership (phase 1)` (do not run git commit).

---

## Self-Review

- **Spec coverage (phase 1 scope):** `Membership` table with the spec's fields + `@@unique([tenantId,userId])` (Task 1); tenant-scoped registration (Task 1); backfill one-per-user (Task 1 migration; safe — 0 prod dups); `protectedProcedure` resolves membership + no-membership ⇒ unauthorized (Task 2, matches §D.6); role checks via `ctx.membership.role` (Task 2). **Deferred to Phase 2 (explicitly NOT here):** dropping `User` columns, global-unique email, the 40 `ctx.user.*`→`ctx.membership.*` sweep, "invite existing email to a second tenant", GDPR-erasure-per-membership, removing `User` from `TENANT_SCOPED_MODELS`. Non-goals (switch-UI, per-tenant names) untouched.
- **Placeholder scan:** none. Step 3's "adjust `{}` to the real input shape" is a concrete instruction to match `listUsersSchema`, not a vague gap.
- **Type consistency:** `ctx.membership` shape `{ id, role, schoolId, tenantId }` is produced in Task 2 Step 1 and read in Step 2 + tests; `db.membership` fields match the schema in Task 1.
- **Reversibility:** nothing dropped/renamed; rollback = drop the table + revert `trpc.ts`. Safe to ship and deploy independently; Phase 2 is a separate plan written only after this is proven live.

# Admin Operational Actions — Implementation Plan (Sub-project 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give operators real mutation power from `admin.convlyx.com`: suspend/reactivate a tenant (and make suspend actually lock the tenant out), rename a tenant, edit school settings, and activate/deactivate staff memberships — all audited, all confirmed in the UI.

**Architecture:** Add an `admin.ops` tRPC router of `adminProcedure` mutations (raw cross-tenant db, each calling `ctx.audit(...)`). First close the enforcement gap so `Tenant.status = INACTIVE` denies access everywhere: fold the tenant's status into the per-request membership load and reject it in `protectedProcedure`, and mirror the check in `getDashboardUser` for pages. Then wire the mutations into the existing per-account page with confirm dialogs.

**Tech Stack:** Next.js 16 App Router, tRPC v11, Prisma 7, Zod v4, Tailwind v4, Supabase Auth, Vitest 4.

## Global Constraints

- **Package manager: `pnpm`.**
- **Git is user-driven.** Do NOT run `git add`/`commit`. Each "Checkpoint" states the commit message for the user.
- **Internal operator UI is non-i18n** — hardcoded Portuguese, no `messages/pt-PT.json` keys.
- **All operator mutations run through `adminProcedure`** (raw cross-tenant db) and MUST call `ctx.audit({ action, targetType, targetId, metadata })`.
- **No timezone edits.** `School.timeZone` is fixed at creation (changing it rewrites historical class/exam time conversion) — `updateSchool` must not touch it.
- **Zero-tolerance gates:** `pnpm type-check` and `pnpm lint` both pass before a task is done.
- **Aggregates + staff only.** Staff (ADMIN/SECRETARY) contact info is allowed; no student PII in this sub-project.
- **Validation:** Zod schemas import from `"zod/v4"`.

---

## File Structure

**Create:**
- `src/server/routers/admin/ops.ts` — the ops mutation router
- `tests/admin-suspend-enforcement.test.ts` — tenant-suspend lockout
- `tests/admin-ops.test.ts` — ops mutations + audit
- `src/app/platform-admin/tenants/[tenantId]/_components/tenant-actions.tsx` — suspend/reactivate/rename dialogs
- `src/app/platform-admin/tenants/[tenantId]/_components/edit-school-dialog.tsx` — school settings dialog

**Modify:**
- `src/server/trpc.ts` — add `tenant.status` to `MembershipContext` + the membership select; reject non-ACTIVE tenant in `protectedProcedure`
- `src/server/ssr.ts` — add `tenant: { status: "ACTIVE" }` to the inline `loadMembership` return
- `tests/helpers/tenant.ts` — add `tenant: { select: { status: true } }` to `testLoadMembership`
- `src/server/dashboard-user.ts` — select `tenant.status`; sign out + return null if INACTIVE
- `src/lib/validations/admin.ts` — ops input schemas
- `src/server/routers/admin/index.ts` — mount `ops`
- `src/server/routers/admin/account.ts` — add `membershipId` + `status` to `account.get`'s staff rows
- `src/app/platform-admin/tenants/[tenantId]/_components/account-detail.tsx` — render tenant actions, school edit, staff activate/deactivate

---

# PHASE 0 — Make suspend real

### Task 1: Tenant-suspend enforcement

**Files:**
- Modify: `src/server/trpc.ts`, `src/server/ssr.ts`, `src/server/dashboard-user.ts`, `tests/helpers/tenant.ts`
- Test: `tests/admin-suspend-enforcement.test.ts`

**Interfaces:**
- Produces: `MembershipContext.tenant: { status: TenantStatus }`; `protectedProcedure` rejects when the tenant is not ACTIVE.
- Consumes: `TenantStatus` from `@/generated/prisma/enums`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/admin-suspend-enforcement.test.ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { cleanupTenants, createTestTenant, type TestTenant } from "./helpers/tenant";

describe("tenant suspend enforcement", () => {
  let a: TestTenant;
  beforeAll(async () => { a = await createTestTenant("SUS"); });
  afterAll(async () => { await cleanupTenants(a.tenantId); });

  it("blocks all protected access when the tenant is INACTIVE, restores when ACTIVE", async () => {
    // Active → a protected procedure works.
    await expect(a.asAdmin.novidades.feed()).resolves.toBeDefined();

    await db.tenant.update({ where: { id: a.tenantId }, data: { status: "INACTIVE" } });
    await expect(a.asAdmin.novidades.feed()).rejects.toThrow();

    await db.tenant.update({ where: { id: a.tenantId }, data: { status: "ACTIVE" } });
    await expect(a.asAdmin.novidades.feed()).resolves.toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/admin-suspend-enforcement.test.ts`
Expected: FAIL — the INACTIVE call resolves instead of rejecting (no enforcement yet).

- [ ] **Step 3: Add tenant status to the membership context type**

In `src/server/trpc.ts`, extend `MembershipContext` and import the enum type:

```ts
import type { UserRole, UserStatus, TenantStatus } from "@/generated/prisma/enums";

type MembershipContext = {
  role: UserRole;
  schoolId: string;
  tenantId: string;
  status: UserStatus;
  lastSeenAt: Date | null;
  tenant: { status: TenantStatus };
};
```

- [ ] **Step 4: Select the tenant status in the membership loader**

In `createTRPCContext`'s `loadMembership`, add the relation to the select:

```ts
      membershipPromise = db.membership.findFirst({
        where: { userId, tenantId },
        select: {
          role: true, schoolId: true, tenantId: true, status: true, lastSeenAt: true,
          tenant: { select: { status: true } },
        },
      });
```

- [ ] **Step 5: Reject a non-ACTIVE tenant in `protectedProcedure`**

Replace the membership guard in `protectedProcedure`:

```ts
  const membership = await ctx.loadMembership();
  // No membership ⇒ not a member here. INACTIVE membership ⇒ deactivated in
  // this tenant. INACTIVE tenant ⇒ the whole school is suspended by a platform
  // operator. All three are unauthorized — don't leak the tenant's existence.
  if (!membership || membership.status !== "ACTIVE" || membership.tenant.status !== "ACTIVE") {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "auth.notAuthenticated",
    });
  }
```

- [ ] **Step 6: Update the SSR + test membership shapes**

In `src/server/ssr.ts`, the inline `loadMembership` return gains the tenant field:

```ts
    loadMembership: async () =>
      user
        ? { role: user.role, schoolId: user.schoolId, tenantId: user.tenantId, status: "ACTIVE", lastSeenAt: null, tenant: { status: "ACTIVE" } }
        : null,
```

In `tests/helpers/tenant.ts`, `testLoadMembership` selects the relation:

```ts
    db.membership.findFirst({
      where: { userId, tenantId },
      select: {
        role: true, schoolId: true, tenantId: true, status: true, lastSeenAt: true,
        tenant: { select: { status: true } },
      },
    });
```

- [ ] **Step 7: Mirror the check for pages in `getDashboardUser`**

In `src/server/dashboard-user.ts`, add `tenant.status` to the school select and block INACTIVE tenants. Change the school select's `tenant` to `tenant: { select: { name: true, status: true } }`, then after the membership guard add:

```ts
      if (school.tenant.status !== "ACTIVE") {
        // Tenant suspended by a platform operator — no dashboard access.
        await supabase.auth.signOut();
        return null;
      }
```

- [ ] **Step 8: Run the test + full suite + gates**

Run: `pnpm vitest run tests/admin-suspend-enforcement.test.ts && pnpm type-check && pnpm lint`
Expected: enforcement test PASS, type-check clean, lint 0 errors.
Then: `pnpm vitest run` — all suites green (the widened `MembershipContext` compiles everywhere).

- [ ] **Step 9: Checkpoint**

Commit message: `feat(admin): enforce tenant suspension across trpc + pages`

---

# PHASE 1 — Ops mutations

### Task 2: Tenant ops — suspend / reactivate / rename

**Files:**
- Create: `src/server/routers/admin/ops.ts`
- Modify: `src/lib/validations/admin.ts`, `src/server/routers/admin/index.ts`
- Test: `tests/admin-ops.test.ts`

**Interfaces:**
- Produces:
  - `admin.ops.suspendTenant({ tenantId }) → { status: "INACTIVE" }`
  - `admin.ops.reactivateTenant({ tenantId }) → { status: "ACTIVE" }`
  - `admin.ops.renameTenant({ tenantId, name }) → { id, name }`
  - schemas `adminTenantIdSchema`, `renameTenantSchema`.

- [ ] **Step 1: Add validation schemas**

Append to `src/lib/validations/admin.ts`:

```ts
export const adminTenantIdSchema = z.object({ tenantId: z.string().uuid() });

export const renameTenantSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
});

export const updateSchoolSchema = z.object({
  schoolId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  address: z.string().trim().max(300).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  cancellationNoticeHours: z.number().int().min(0).max(168),
  practicalSelfEnrollEnabled: z.boolean(),
});

export const listStaffSchema = z.object({ schoolId: z.string().uuid() });

export const setMembershipStatusSchema = z.object({
  membershipId: z.string().uuid(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/admin-ops.test.ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createCallerFactory, type TRPCContext } from "@/server/trpc";
import { appRouter } from "@/server/routers/_app";
import { createTestTenant, cleanupTenants, type TestTenant } from "./helpers/tenant";

const createCaller = createCallerFactory(appRouter);
function adminCaller(): ReturnType<typeof createCaller> {
  const ctx: TRPCContext = {
    db, tenantId: null, ip: null, user: { id: "op" }, userEmail: "op@convlyx.com",
    loadMembership: async () => null,
  };
  return createCaller(ctx);
}

const originalEmails = process.env.PLATFORM_ADMIN_EMAILS;
let a: TestTenant;
beforeAll(async () => { process.env.PLATFORM_ADMIN_EMAILS = "op@convlyx.com"; a = await createTestTenant("OPS"); });
afterAll(async () => {
  if (originalEmails === undefined) delete process.env.PLATFORM_ADMIN_EMAILS;
  else process.env.PLATFORM_ADMIN_EMAILS = originalEmails;
  await cleanupTenants(a.tenantId);
});

describe("admin.ops tenant actions", () => {
  it("suspends, reactivates and audits", async () => {
    await adminCaller().admin.ops.suspendTenant({ tenantId: a.tenantId });
    expect((await db.tenant.findUnique({ where: { id: a.tenantId }, select: { status: true } }))?.status).toBe("INACTIVE");

    await adminCaller().admin.ops.reactivateTenant({ tenantId: a.tenantId });
    expect((await db.tenant.findUnique({ where: { id: a.tenantId }, select: { status: true } }))?.status).toBe("ACTIVE");

    const audits = await db.auditLog.findMany({ where: { targetId: a.tenantId, action: { in: ["tenant.suspend", "tenant.reactivate"] } } });
    expect(audits.length).toBe(2);
  });

  it("renames a tenant", async () => {
    await adminCaller().admin.ops.renameTenant({ tenantId: a.tenantId, name: "Renomeado" });
    expect((await db.tenant.findUnique({ where: { id: a.tenantId }, select: { name: true } }))?.name).toBe("Renomeado");
  });

  it("rejects a non-operator", async () => {
    const ctx: TRPCContext = { db, tenantId: null, ip: null, user: { id: "x" }, userEmail: "nope@x.com", loadMembership: async () => null };
    await expect(createCaller(ctx).admin.ops.suspendTenant({ tenantId: a.tenantId })).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run to verify fail**

Run: `pnpm vitest run tests/admin-ops.test.ts`
Expected: FAIL — `admin.ops` undefined.

- [ ] **Step 4: Implement the ops router (tenant actions)**

```ts
// src/server/routers/admin/ops.ts
import { TRPCError } from "@trpc/server";
import { router, adminProcedure } from "../../trpc";
import {
  adminTenantIdSchema, renameTenantSchema, updateSchoolSchema,
  listStaffSchema, setMembershipStatusSchema,
} from "@/lib/validations/admin";

async function requireTenant(db: typeof import("../../db").db, tenantId: string) {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } });
  if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "errors.notFound" });
  return tenant;
}

export const opsRouter = router({
  suspendTenant: adminProcedure.input(adminTenantIdSchema).mutation(async ({ ctx, input }) => {
    const tenant = await requireTenant(ctx.db, input.tenantId);
    await ctx.db.tenant.update({ where: { id: tenant.id }, data: { status: "INACTIVE" } });
    await ctx.audit({ action: "tenant.suspend", targetType: "tenant", targetId: tenant.id, metadata: { name: tenant.name } });
    return { status: "INACTIVE" as const };
  }),

  reactivateTenant: adminProcedure.input(adminTenantIdSchema).mutation(async ({ ctx, input }) => {
    const tenant = await requireTenant(ctx.db, input.tenantId);
    await ctx.db.tenant.update({ where: { id: tenant.id }, data: { status: "ACTIVE" } });
    await ctx.audit({ action: "tenant.reactivate", targetType: "tenant", targetId: tenant.id, metadata: { name: tenant.name } });
    return { status: "ACTIVE" as const };
  }),

  renameTenant: adminProcedure.input(renameTenantSchema).mutation(async ({ ctx, input }) => {
    const tenant = await requireTenant(ctx.db, input.tenantId);
    const updated = await ctx.db.tenant.update({ where: { id: tenant.id }, data: { name: input.name }, select: { id: true, name: true } });
    await ctx.audit({ action: "tenant.update", targetType: "tenant", targetId: tenant.id, metadata: { from: tenant.name, to: updated.name } });
    return updated;
  }),
});
```

- [ ] **Step 5: Mount the router**

In `src/server/routers/admin/index.ts`, import `opsRouter` and add `ops: opsRouter`.

- [ ] **Step 6: Run tests + gates**

Run: `pnpm vitest run tests/admin-ops.test.ts && pnpm type-check && pnpm lint`
Expected: tenant tests PASS (the updateSchool/staff tests are added in Tasks 3–4; write only the tenant `describe` for now, or expect those to fail until implemented — keep this task's test file limited to the tenant `describe` and add more `describe` blocks in later tasks).

- [ ] **Step 7: Checkpoint**

Commit message: `feat(admin): ops router — suspend/reactivate/rename tenant`

---

### Task 3: Ops — update school settings

**Files:**
- Modify: `src/server/routers/admin/ops.ts`
- Test: extend `tests/admin-ops.test.ts`

**Interfaces:**
- Produces: `admin.ops.updateSchool(input: z.infer<typeof updateSchoolSchema>) → { id }`. Never updates `timeZone`.

- [ ] **Step 1: Write the failing test (new describe)**

```ts
describe("admin.ops.updateSchool", () => {
  it("updates editable fields and audits (not timezone)", async () => {
    const before = await db.school.findUnique({ where: { id: a.schoolId }, select: { timeZone: true } });
    await adminCaller().admin.ops.updateSchool({
      schoolId: a.schoolId,
      name: "Escola Editada",
      address: "Rua X",
      phone: "912345678",
      cancellationNoticeHours: 48,
      practicalSelfEnrollEnabled: true,
    });
    const after = await db.school.findUnique({
      where: { id: a.schoolId },
      select: { name: true, address: true, cancellationNoticeHours: true, practicalSelfEnrollEnabled: true, timeZone: true },
    });
    expect(after?.name).toBe("Escola Editada");
    expect(after?.cancellationNoticeHours).toBe(48);
    expect(after?.practicalSelfEnrollEnabled).toBe(true);
    expect(after?.timeZone).toBe(before?.timeZone); // unchanged
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm vitest run tests/admin-ops.test.ts`
Expected: FAIL — `updateSchool` undefined.

- [ ] **Step 3: Implement `updateSchool`**

Add to `opsRouter`:

```ts
  updateSchool: adminProcedure.input(updateSchoolSchema).mutation(async ({ ctx, input }) => {
    const school = await ctx.db.school.findUnique({ where: { id: input.schoolId }, select: { id: true, tenantId: true } });
    if (!school) throw new TRPCError({ code: "NOT_FOUND", message: "errors.notFound" });
    await ctx.db.school.update({
      where: { id: school.id },
      data: {
        name: input.name,
        address: input.address ?? null,
        phone: input.phone ?? null,
        cancellationNoticeHours: input.cancellationNoticeHours,
        practicalSelfEnrollEnabled: input.practicalSelfEnrollEnabled,
        // timeZone deliberately omitted — fixed at creation.
      },
    });
    await ctx.audit({ action: "school.update", targetType: "school", targetId: school.id, metadata: { tenantId: school.tenantId, name: input.name } });
    return { id: school.id };
  }),
```

- [ ] **Step 4: Run tests + gates**

Run: `pnpm vitest run tests/admin-ops.test.ts && pnpm type-check && pnpm lint`
Expected: green.

- [ ] **Step 5: Checkpoint**

Commit message: `feat(admin): ops — update school settings (no timezone)`

---

### Task 4: Ops — list staff + set membership status; extend account.get staff

**Files:**
- Modify: `src/server/routers/admin/ops.ts`, `src/server/routers/admin/account.ts`
- Test: extend `tests/admin-ops.test.ts`, `tests/admin-account.test.ts`

**Interfaces:**
- Produces:
  - `admin.ops.listStaff({ schoolId }) → { membershipId, name, email, phone, role, status }[]` (ADMIN/SECRETARY only)
  - `admin.ops.setMembershipStatus({ membershipId, status }) → { id, status }` (audits `membership.deactivate` / `membership.reactivate`)
  - `account.get`'s `members.staff[]` now also carries `membershipId` and `status`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/admin-ops.test.ts`:

```ts
describe("admin.ops staff management", () => {
  it("lists staff (admin/secretary), excludes students", async () => {
    const staff = await adminCaller().admin.ops.listStaff({ schoolId: a.schoolId });
    expect(staff.every((s) => s.role !== "STUDENT")).toBe(true);
    expect(staff.some((s) => s.role === "ADMIN")).toBe(true);
  });
  it("deactivates then reactivates a membership and audits", async () => {
    const staff = await adminCaller().admin.ops.listStaff({ schoolId: a.schoolId });
    const admin = staff.find((s) => s.role === "ADMIN")!;
    await adminCaller().admin.ops.setMembershipStatus({ membershipId: admin.membershipId, status: "INACTIVE" });
    expect((await db.membership.findUnique({ where: { id: admin.membershipId }, select: { status: true } }))?.status).toBe("INACTIVE");
    await adminCaller().admin.ops.setMembershipStatus({ membershipId: admin.membershipId, status: "ACTIVE" });
    expect((await db.membership.findUnique({ where: { id: admin.membershipId }, select: { status: true } }))?.status).toBe("ACTIVE");
    const audits = await db.auditLog.findMany({ where: { targetId: admin.membershipId } });
    expect(audits.length).toBeGreaterThanOrEqual(2);
  });
});
```

Append to `tests/admin-account.test.ts` (inside the existing `admin.account.get` describe):

```ts
  it("staff rows carry membershipId and status", async () => {
    const res = await adminCaller().admin.account.get({ tenantId: a.tenantId });
    expect(res.members.staff.every((m) => typeof m.membershipId === "string" && (m.status === "ACTIVE" || m.status === "INACTIVE"))).toBe(true);
  });
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm vitest run tests/admin-ops.test.ts tests/admin-account.test.ts`
Expected: FAIL — `listStaff` undefined + `membershipId` missing.

- [ ] **Step 3: Implement `listStaff` + `setMembershipStatus`**

Add to `opsRouter`:

```ts
  listStaff: adminProcedure.input(listStaffSchema).query(async ({ ctx, input }) => {
    const rows = await ctx.db.membership.findMany({
      where: { schoolId: input.schoolId, role: { in: ["ADMIN", "SECRETARY"] } },
      select: { id: true, name: true, phone: true, role: true, status: true, user: { select: { email: true } } },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });
    return rows.map((r) => ({
      membershipId: r.id, name: r.name, email: r.user.email, phone: r.phone, role: r.role, status: r.status,
    }));
  }),

  setMembershipStatus: adminProcedure.input(setMembershipStatusSchema).mutation(async ({ ctx, input }) => {
    const m = await ctx.db.membership.findUnique({ where: { id: input.membershipId }, select: { id: true, tenantId: true } });
    if (!m) throw new TRPCError({ code: "NOT_FOUND", message: "errors.notFound" });
    await ctx.db.membership.update({ where: { id: m.id }, data: { status: input.status } });
    await ctx.audit({
      action: input.status === "ACTIVE" ? "membership.reactivate" : "membership.deactivate",
      targetType: "user", targetId: m.id, metadata: { tenantId: m.tenantId },
    });
    return { id: m.id, status: input.status };
  }),
```

- [ ] **Step 4: Extend `account.get`'s staff rows**

In `src/server/routers/admin/account.ts`, the `staff` findMany `select` gains `id` + `status`, and the mapped object gains `membershipId` + `status`:

```ts
        ctx.db.membership.findMany({
          where: { tenantId: tenant.id, role: { in: ["ADMIN", "SECRETARY", "INSTRUCTOR"] } },
          select: {
            id: true, role: true, status: true, name: true, phone: true,
            user: { select: { email: true } }, school: { select: { name: true } },
          },
          orderBy: [{ role: "asc" }, { name: "asc" }],
        }),
```

and:

```ts
        staff: staff.map((m) => ({
          membershipId: m.id,
          name: m.name,
          email: m.user.email,
          phone: m.phone,
          role: m.role,
          status: m.status,
          schoolName: m.school.name,
        })),
```

- [ ] **Step 5: Run tests + gates**

Run: `pnpm vitest run tests/admin-ops.test.ts tests/admin-account.test.ts && pnpm type-check && pnpm lint`
Expected: green.

- [ ] **Step 6: Checkpoint**

Commit message: `feat(admin): ops — staff list + activate/deactivate membership`

---

# PHASE 2 — UI wiring (per-account page)

### Task 5: Tenant actions on the account page

**Files:**
- Create: `src/app/platform-admin/tenants/[tenantId]/_components/tenant-actions.tsx`
- Modify: `src/app/platform-admin/tenants/[tenantId]/_components/account-detail.tsx`

**Interfaces:**
- Consumes: `admin.ops.{suspendTenant,reactivateTenant,renameTenant}`, `trpc.useUtils()`.

- [ ] **Step 1: Build the tenant-actions component**

```tsx
// src/app/platform-admin/tenants/[tenantId]/_components/tenant-actions.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody,
} from "@/components/ui/dialog";

export function TenantActions({
  tenantId,
  tenantName,
  status,
}: {
  tenantId: string;
  tenantName: string;
  status: "ACTIVE" | "INACTIVE";
}) {
  const utils = trpc.useUtils();
  const [renameOpen, setRenameOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [name, setName] = useState(tenantName);
  const [confirmName, setConfirmName] = useState("");

  const invalidate = () => {
    utils.admin.account.get.invalidate({ tenantId });
    utils.admin.portfolio.overview.invalidate();
    utils.admin.portfolio.kpis.invalidate();
  };

  const suspend = trpc.admin.ops.suspendTenant.useMutation({
    onSuccess: () => { toast.success("Grupo suspenso"); setSuspendOpen(false); setConfirmName(""); invalidate(); },
    onError: () => toast.error("Erro ao suspender"),
  });
  const reactivate = trpc.admin.ops.reactivateTenant.useMutation({
    onSuccess: () => { toast.success("Grupo reativado"); invalidate(); },
    onError: () => toast.error("Erro ao reativar"),
  });
  const rename = trpc.admin.ops.renameTenant.useMutation({
    onSuccess: () => { toast.success("Grupo renomeado"); setRenameOpen(false); invalidate(); },
    onError: () => toast.error("Erro ao renomear"),
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => { setName(tenantName); setRenameOpen(true); }}>
        Renomear
      </Button>
      {status === "ACTIVE" ? (
        <Button variant="outline" size="sm" className="text-destructive" onClick={() => setSuspendOpen(true)}>
          Suspender
        </Button>
      ) : (
        <Button size="sm" onClick={() => reactivate.mutate({ tenantId })} disabled={reactivate.isPending}>
          Reativar
        </Button>
      )}

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Renomear grupo</DialogTitle></DialogHeader>
          <DialogBody>
            <div className="grid gap-2">
              <Label htmlFor="ta-name">Nome</Label>
              <Input id="ta-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancelar</Button>
            <Button onClick={() => rename.mutate({ tenantId, name })} disabled={rename.isPending || !name.trim()}>
              {rename.isPending ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend confirm-by-name dialog */}
      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Suspender grupo</DialogTitle></DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">
              Suspender bloqueia o acesso de todos os utilizadores deste grupo. Escreva
              <span className="font-medium text-foreground"> {tenantName} </span>
              para confirmar.
            </p>
            <Input className="mt-3" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} aria-label="Confirmar nome do grupo" />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)}>Cancelar</Button>
            <Button
              className="text-destructive"
              variant="outline"
              onClick={() => suspend.mutate({ tenantId })}
              disabled={suspend.isPending || confirmName !== tenantName}
            >
              {suspend.isPending ? "A suspender…" : "Suspender"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Render it in the account header**

In `account-detail.tsx`, import `TenantActions` and place it in the header block, to the right of the title/status. After the `<div className="space-y-1">…</div>` header, wrap the header + actions in a `flex justify-between`:

```tsx
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          {/* ...existing title + status badge + subtitle... */}
        </div>
        <TenantActions tenantId={tenantId} tenantName={tenant.name} status={tenant.status} />
      </div>
```

- [ ] **Step 3: Gates + build**

Run: `pnpm type-check && pnpm lint && pnpm build`
Expected: clean; `/platform-admin/tenants/[tenantId]` compiles.

- [ ] **Step 4: Checkpoint**

Commit message: `feat(admin): tenant suspend/reactivate/rename actions on account page`

---

### Task 6: School edit + staff management on the account page

**Files:**
- Create: `src/app/platform-admin/tenants/[tenantId]/_components/edit-school-dialog.tsx`
- Modify: `src/app/platform-admin/tenants/[tenantId]/_components/account-detail.tsx`

**Interfaces:**
- Consumes: `admin.ops.{updateSchool,setMembershipStatus}`, the extended `account.get` staff rows (`membershipId`, `status`).

- [ ] **Step 1: Build the edit-school dialog**

```tsx
// src/app/platform-admin/tenants/[tenantId]/_components/edit-school-dialog.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody,
} from "@/components/ui/dialog";

type SchoolConfig = {
  id: string;
  name: string;
  config: { cancellationNoticeHours: number; practicalSelfEnrollEnabled: boolean };
};

export function EditSchoolDialog({ tenantId, school }: { tenantId: string; school: SchoolConfig }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(school.name);
  const [notice, setNotice] = useState(String(school.config.cancellationNoticeHours));
  const [selfEnroll, setSelfEnroll] = useState(school.config.practicalSelfEnrollEnabled);

  const update = trpc.admin.ops.updateSchool.useMutation({
    onSuccess: () => {
      toast.success("Escola atualizada");
      setOpen(false);
      utils.admin.account.get.invalidate({ tenantId });
    },
    onError: () => toast.error("Erro ao atualizar escola"),
  });

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Editar</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar escola</DialogTitle></DialogHeader>
          <DialogBody>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="es-name">Nome</Label>
                <Input id="es-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="es-notice">Aviso de cancelamento (horas)</Label>
                <Input id="es-notice" type="number" min={0} max={168} value={notice} onChange={(e) => setNotice(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={selfEnroll} onCheckedChange={(v) => setSelfEnroll(v === true)} />
                Auto-inscrição prática
              </label>
              <p className="text-xs text-muted-foreground">O fuso horário não é editável — altera a conversão de horas históricas.</p>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => update.mutate({
                schoolId: school.id,
                name,
                cancellationNoticeHours: Number(notice) || 0,
                practicalSelfEnrollEnabled: selfEnroll,
              })}
              disabled={update.isPending || !name.trim()}
            >
              {update.isPending ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Wire edit + staff toggles into `account-detail.tsx`**

(a) Import both new pieces:

```tsx
import { TenantActions } from "./tenant-actions";
import { EditSchoolDialog } from "./edit-school-dialog";
```

(b) In the Config panel, add the edit button per school. Change the school row header to include it:

```tsx
              <div key={s.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{s.name} <span className="text-muted-foreground">· {s.subdomain}</span></p>
                  <EditSchoolDialog tenantId={tenantId} school={{ id: s.id, name: s.name, config: { cancellationNoticeHours: s.config.cancellationNoticeHours, practicalSelfEnrollEnabled: s.config.practicalSelfEnrollEnabled } }} />
                </div>
                {/* ...existing <ul> config list... */}
              </div>
```

(c) In the Members staff table, add a Status column + an activate/deactivate action. Add a mutation at the top of `AccountDetail`:

```tsx
  const setStatus = trpc.admin.ops.setMembershipStatus.useMutation({
    onSuccess: () => utils.admin.account.get.invalidate({ tenantId }),
  });
```

and `const utils = trpc.useUtils();` near the top. Then add a header cell `<TableHead>Estado</TableHead>` and, per staff row, a status + toggle cell:

```tsx
                    <TableCell>
                      {m.status === "ACTIVE" ? (
                        <Button variant="ghost" size="sm" className="text-destructive"
                          disabled={setStatus.isPending}
                          onClick={() => setStatus.mutate({ membershipId: m.membershipId, status: "INACTIVE" })}>
                          Desativar
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm"
                          disabled={setStatus.isPending}
                          onClick={() => setStatus.mutate({ membershipId: m.membershipId, status: "ACTIVE" })}>
                          Reativar
                        </Button>
                      )}
                    </TableCell>
```

(Instructor rows appear in the staff table too; they can be toggled the same way — that's fine, deactivating an instructor membership locks that person out of that tenant.)

- [ ] **Step 3: Gates + build**

Run: `pnpm type-check && pnpm lint && pnpm build`
Expected: clean; account route compiles.

- [ ] **Step 4: Checkpoint**

Commit message: `feat(admin): school edit + staff activate/deactivate on account page`

---

## Self-Review

**Spec coverage (§6 of the design):**
- Suspend/reactivate tenant + **verified enforcement** → Task 1 (enforcement) + Task 2 (mutations) + Task 5 (UI).
- Edit tenant (rename) → Task 2 + Task 5.
- Edit school settings (no timezone) → Task 3 + Task 6.
- Manage admins (deactivate/reactivate membership) → Task 4 + Task 6.
- All audited → every mutation calls `ctx.audit`; verified in Task 2/4 tests.
- Confirm dialogs / type-to-confirm on destructive suspend → Task 5.
- **Deferred (documented):** Supabase password-reset / resend-invite (§6 listed it "loosely") — needs Supabase email-flow config and is lower value than activation control; left for a follow-up. `School.status` per-school disable — not added (schema has no such column); per-school control is via deactivating that school's memberships. Both noted here so the omission is explicit, not a silent gap.

**Placeholder scan:** No TBD/TODO. Every step has concrete code or an exact command. The one intentional deferral (password reset) is called out with rationale.

**Type consistency:** `MembershipContext.tenant.status` used identically in `protectedProcedure`, `ssr.ts`, and `testLoadMembership`. `updateSchoolSchema` fields match `EditSchoolDialog`'s `mutate` call (name, cancellationNoticeHours, practicalSelfEnrollEnabled; address/phone optional). `account.get` staff shape (`membershipId`, `status`) matches the Task 6 table usage and the Task 4 test. `setMembershipStatus` input (`membershipId`, `status`) matches both the ops test and the UI mutation. Audit verbs (`tenant.suspend/reactivate/update`, `school.update`, `membership.deactivate/reactivate`) are consistent between router and tests.

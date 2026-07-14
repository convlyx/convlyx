# Admin Hardening & Support Tooling — Implementation Plan (Sub-project 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin console's audit trail actually usable and trustworthy, and add the two support actions operators will reach for most (find a user across tenants, reset a school admin's password) — plus fix the overview's risk-filter accuracy.

**Architecture:** Five focused changes. (1) Make PII-access auditing fail-closed. (2) Upgrade the audit viewer with pagination + target/date filters. (3) Make the portfolio overview's risk filter + computed sorts correct by enriching the full filtered set before paginating (no schema change — the school count is bounded). (4) Add an audited cross-tenant user lookup. (5) Add an audited "reset password" that mints a Supabase recovery link for an operator to relay. All new server logic runs through `adminProcedure` (audited) except the existing server-component audit page (already gated by the platform-admin layout).

**Tech Stack:** Next.js 16 App Router, tRPC v11, Prisma 7, Zod v4, Supabase Auth (service role), Tailwind v4, Vitest 4.

## Global Constraints

- **Package manager: `pnpm`.**
- **Git is user-driven.** Do NOT run `git add`/`commit`. Each "Checkpoint" states the commit message.
- **Internal operator UI is non-i18n** — hardcoded Portuguese, no `messages/pt-PT.json` keys.
- **Mutations + PII reads run through `adminProcedure` and call `ctx.audit(...)`.** PII reads use the **fail-closed** audit added in Task 1.
- **No new Prisma migration** in this sub-project (all changes are query/UI/logic).
- **Validation:** Zod schemas import from `"zod/v4"`.
- **Zero-tolerance gates:** `pnpm type-check` and `pnpm lint` both pass before a task is done.

---

## File Structure

**Create:**
- `src/server/lib/audit-query.ts` — pure `buildAuditWhere()` filter builder
- `tests/audit-query.test.ts`
- `tests/audit-strict.test.ts`
- `src/app/platform-admin/lookup/page.tsx` + `_components/user-lookup.tsx` — cross-tenant user lookup
- `tests/admin-lookup.test.ts`

**Modify:**
- `src/server/lib/audit.ts` — add `strict` option (rethrow on write failure)
- `src/server/routers/admin/support.ts` — pass `strict: true` on PII audits; add `lookupUser`
- `src/lib/validations/admin.ts` — `supportLookupSchema`, `resetPasswordSchema`
- `src/server/routers/admin/ops.ts` — add `sendPasswordReset`
- `src/app/platform-admin/audit/page.tsx` + `_components/audit-log-list.tsx` — pagination + target/date filters
- `src/server/routers/admin/portfolio.ts` — overview: enrich full filtered set, then paginate
- `src/app/platform-admin/_components/portfolio-overview.tsx` — add "Procurar utilizador" header link
- `src/app/platform-admin/tenants/[tenantId]/_components/account-detail.tsx` — "Repor palavra-passe" action per staff row

---

# TIER 1

### Task 1: Fail-closed audit for PII reads

**Files:**
- Modify: `src/server/lib/audit.ts`, `src/server/routers/admin/support.ts`
- Test: `tests/audit-strict.test.ts`

**Interfaces:**
- Produces: `audit(params)` accepts an optional `strict?: boolean`; when `true` and the write throws, it **rethrows** (after logging) instead of swallowing. Default (absent/false) keeps today's best-effort behavior.
- Consumes: nothing new. Support PII procedures call `ctx.audit({ ..., strict: true })`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/audit-strict.test.ts
import { describe, it, expect } from "vitest";
import { audit } from "@/server/lib/audit";
import type { DbClient } from "@/server/lib/tenant-scope";

// Minimal fake db whose auditLog.create always throws.
function failingDb(): DbClient {
  return { auditLog: { create: async () => { throw new Error("db down"); } } } as unknown as DbClient;
}

describe("audit strict mode", () => {
  it("swallows write failures by default (best-effort)", async () => {
    await expect(
      audit({ db: failingDb(), actorEmail: "op@x.com", action: "a.b", targetType: "t", targetId: "1" }),
    ).resolves.toBeUndefined();
  });
  it("rethrows when strict", async () => {
    await expect(
      audit({ db: failingDb(), actorEmail: "op@x.com", action: "a.b", targetType: "t", targetId: "1", strict: true }),
    ).rejects.toThrow(/db down/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/audit-strict.test.ts`
Expected: FAIL — the strict case resolves instead of rejecting (no `strict` support yet).

- [ ] **Step 3: Implement `strict` in `audit()`**

In `src/server/lib/audit.ts`, add `strict?: boolean` to the params type and rethrow in the catch when set:

```ts
export async function audit(params: {
  db: DbClient;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  strict?: boolean;
}) {
  try {
    await params.db.auditLog.create({
      data: {
        actorEmail: params.actorEmail,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        ...(params.metadata ? { metadata: params.metadata as object } : {}),
      },
    });
  } catch (error) {
    logger.warn("audit log write failed", {
      error,
      action: params.action,
      targetId: params.targetId,
    });
    // Fail-closed callers (individual-PII reads) must NOT proceed without a
    // recorded access. Best-effort callers (default) still swallow.
    if (params.strict) throw error;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run tests/audit-strict.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Make the support PII audits strict**

In `src/server/routers/admin/support.ts`, add `strict: true` to both `ctx.audit({...})` calls (in `listStudents` and `getStudent`). Example for `getStudent`:

```ts
    await ctx.audit({
      action: "student.view_detail",
      targetType: "user",
      targetId: input.studentUserId,
      metadata: { tenantId: input.tenantId },
      strict: true,
    });
```

(and likewise the `student.list_view` audit in `listStudents`.)

- [ ] **Step 6: Full support suite + gates**

Run: `pnpm vitest run tests/admin-support.test.ts tests/audit-strict.test.ts && pnpm type-check && pnpm lint`
Expected: green (the existing support tests still pass — the real db write succeeds, so strict is a no-op there).

- [ ] **Step 7: Checkpoint**

Commit message: `feat(admin): fail-closed audit on student PII reads`

---

### Task 2: Audit viewer — pagination + target/date filters

**Files:**
- Create: `src/server/lib/audit-query.ts`, `tests/audit-query.test.ts`
- Modify: `src/app/platform-admin/audit/page.tsx`, `src/app/platform-admin/audit/_components/audit-log-list.tsx`

**Interfaces:**
- Produces: `buildAuditWhere(input: { action?; actor?; target?; sinceDays?: number }, now: Date) → Prisma where object`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/audit-query.test.ts
import { describe, it, expect } from "vitest";
import { buildAuditWhere } from "@/server/lib/audit-query";

const now = new Date("2026-07-14T12:00:00.000Z");

describe("buildAuditWhere", () => {
  it("is empty when nothing is set", () => {
    expect(buildAuditWhere({}, now)).toEqual({});
  });
  it("filters by action, actor and exact target", () => {
    expect(buildAuditWhere({ action: "student.view_detail", actor: "op@x.com", target: "u1" }, now)).toEqual({
      action: "student.view_detail",
      actorEmail: "op@x.com",
      targetId: "u1",
    });
  });
  it("adds a createdAt lower bound for sinceDays", () => {
    const w = buildAuditWhere({ sinceDays: 7 }, now) as { createdAt?: { gte: Date } };
    expect(w.createdAt?.gte).toEqual(new Date("2026-07-07T12:00:00.000Z"));
  });
  it("ignores sinceDays <= 0", () => {
    expect(buildAuditWhere({ sinceDays: 0 }, now)).toEqual({});
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm vitest run tests/audit-query.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `buildAuditWhere`**

```ts
// src/server/lib/audit-query.ts
import type { Prisma } from "@/generated/prisma/client";

/** Pure filter builder for the audit-log viewer. `now` is injected for testability. */
export function buildAuditWhere(
  input: { action?: string; actor?: string; target?: string; sinceDays?: number },
  now: Date,
): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  if (input.action) where.action = input.action;
  if (input.actor) where.actorEmail = input.actor;
  if (input.target) where.targetId = input.target;
  if (input.sinceDays && input.sinceDays > 0) {
    where.createdAt = { gte: new Date(now.getTime() - input.sinceDays * 86_400_000) };
  }
  return where;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run tests/audit-query.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Rewrite the audit page to paginate + filter**

Replace `src/app/platform-admin/audit/page.tsx` body:

```tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/server/db";
import { Button } from "@/components/ui/button";
import { buildAuditWhere } from "@/server/lib/audit-query";
import { AuditLogList } from "./_components/audit-log-list";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const RANGE_DAYS = [7, 30, 90] as const;

export default async function PlatformAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; actor?: string; target?: string; days?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) >= 1 ? Number(params.page) : 1;
  const sinceDays = (RANGE_DAYS as ReadonlyArray<number>).includes(Number(params.days)) ? Number(params.days) : undefined;
  const where = buildAuditWhere(
    { action: params.action, actor: params.actor, target: params.target, sinceDays },
    new Date(),
  );

  const [logs, total, actions, actors] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.auditLog.count({ where }),
    db.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    db.auditLog.findMany({ distinct: ["actorEmail"], select: { actorEmail: true }, orderBy: { actorEmail: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/platform-admin" className="inline-flex">
          <Button variant="ghost" size="sm" className="gap-2 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </Link>
        <h1 className="text-2xl font-bold mt-2">Registo de auditoria</h1>
        <p className="text-sm text-muted-foreground mt-1">{total} entradas.</p>
      </div>

      <AuditLogList
        logs={logs}
        actionOptions={actions.map((a) => a.action)}
        actorOptions={actors.map((a) => a.actorEmail)}
        activeAction={params.action}
        activeActor={params.actor}
        activeTarget={params.target ?? ""}
        activeDays={sinceDays ? String(sinceDays) : "ALL"}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
      />
    </div>
  );
}
```

- [ ] **Step 6: Add the controls + pagination to the list component**

Rewrite `src/app/platform-admin/audit/_components/audit-log-list.tsx` to add a **target** text input (exact `targetId` match, with an on-change URL update that resets page to 1), a **date-range** select (7/30/90/all), a clickable `targetId` (sets the target filter), and the shared `Pagination`. Keep the existing action/actor selects and the row rendering. Key additions:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { ClipboardList } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/radix-select";

type AuditLog = { id: string; actorEmail: string; action: string; targetType: string; targetId: string; metadata: unknown; createdAt: Date };

function actionVariant(action: string): "default" | "secondary" | "destructive" | "outline" {
  if (action.endsWith(".create")) return "default";
  if (action.endsWith(".delete") || action.endsWith(".suspend")) return "destructive";
  if (action.endsWith(".update") || action.endsWith(".view_detail") || action.endsWith(".list_view")) return "secondary";
  return "outline";
}

export function AuditLogList({
  logs, actionOptions, actorOptions, activeAction, activeActor, activeTarget, activeDays, page, pageSize, total,
}: {
  logs: AuditLog[]; actionOptions: string[]; actorOptions: string[];
  activeAction?: string; activeActor?: string; activeTarget: string; activeDays: string;
  page: number; pageSize: number; total: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string, resetPage = true) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "ALL" || value === "") params.delete(key);
    else params.set(key, value);
    if (resetPage) params.delete("page");
    const query = params.toString();
    router.replace(query ? `?${query}` : "?", { scroll: false });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select value={activeAction ?? "ALL"} onValueChange={(v) => setParam("action", v)}>
          <SelectTrigger className="w-auto min-w-[180px]"><SelectValue placeholder="Ação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas as ações</SelectItem>
            {actionOptions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={activeActor ?? "ALL"} onValueChange={(v) => setParam("actor", v)}>
          <SelectTrigger className="w-auto min-w-[220px]"><SelectValue placeholder="Autor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os autores</SelectItem>
            {actorOptions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={activeDays} onValueChange={(v) => setParam("days", v)}>
          <SelectTrigger className="w-auto min-w-[140px]"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Sempre</SelectItem>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
        <Input
          defaultValue={activeTarget}
          placeholder="Filtrar por ID de alvo…"
          className="w-[280px]"
          aria-label="Filtrar por ID de alvo"
          onKeyDown={(e) => { if (e.key === "Enter") setParam("target", (e.target as HTMLInputElement).value.trim()); }}
        />
        {activeTarget && (
          <Button variant="ghost" size="sm" onClick={() => setParam("target", "")}>Limpar alvo</Button>
        )}
      </div>

      {logs.length === 0 ? (
        <EmptyState icon={ClipboardList} message="Sem registos." />
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="divide-y">
            {logs.map((log) => (
              <div key={log.id} className="p-4 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={actionVariant(log.action)}>{log.action}</Badge>
                  <span className="text-xs text-muted-foreground">{log.actorEmail}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(log.createdAt).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>
                <div className="text-xs font-mono text-muted-foreground">
                  {log.targetType}:{" "}
                  <button type="button" className="text-foreground hover:underline" onClick={() => setParam("target", log.targetId)} title="Filtrar por este alvo">
                    {log.targetId}
                  </button>
                </div>
                {log.metadata != null && (
                  <pre className="text-xs bg-muted/40 rounded px-2 py-1.5 overflow-x-auto">{JSON.stringify(log.metadata, null, 2)}</pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Pagination page={page} totalPages={Math.ceil(total / pageSize)} total={total} onPageChange={(p) => setParam("page", String(p), false)} />
    </div>
  );
}
```

- [ ] **Step 7: Gates + build**

Run: `pnpm type-check && pnpm lint && pnpm build`
Expected: clean; `/platform-admin/audit` compiles.

- [ ] **Step 8: Checkpoint**

Commit message: `feat(admin): audit viewer pagination + target/date filters`

---

# TIER 2

### Task 3: Overview risk-filter + computed-sort accuracy

**Files:**
- Modify: `src/server/routers/admin/portfolio.ts`
- Test: extend `tests/admin-portfolio.test.ts`

**Interfaces:**
- `admin.portfolio.overview` return shape is unchanged (`{ items, total }`). Behavior change: `risk` filter and `students`/`classes30d` sorts now apply across the **full** name/status-filtered set before pagination, and `total` reflects the risk-filtered count.

- [ ] **Step 1: Write the failing test (append to `tests/admin-portfolio.test.ts`)**

```ts
it("risk filter returns only that health and a correct total", async () => {
  const caller = adminCaller("op@convlyx.com");
  const all = await caller.admin.portfolio.overview({ page: 1, pageSize: 100, status: "ALL", risk: "ALL", sort: "name" });
  const healthyCount = all.items.filter((i) => i.health === "HEALTHY").length;
  const healthy = await caller.admin.portfolio.overview({ page: 1, pageSize: 100, status: "ALL", risk: "HEALTHY", sort: "name" });
  expect(healthy.items.every((i) => i.health === "HEALTHY")).toBe(true);
  expect(healthy.total).toBe(healthyCount);
  expect(healthy.items.length).toBe(healthyCount);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm vitest run tests/admin-portfolio.test.ts`
Expected: FAIL — today `total` is the pre-risk-filter school count, so `healthy.total` won't equal `healthyCount` (unless they happen to match).

- [ ] **Step 3: Refactor `overview` to enrich-all-then-paginate**

In `src/server/routers/admin/portfolio.ts`, change `overview` so it:
1. Loads **all** schools matching the name/status filter (drop `skip`/`take` on the initial `findMany`; keep `where` + `orderBy`).
2. Runs the grouped aggregates over all those `ids` (unchanged queries, just a larger `ids`).
3. Builds the enriched `items` for all of them (unchanged mapping).
4. Applies the `risk` filter and the `students`/`classes30d` sorts to the **full** list.
5. Sets `total = items.length` **after** filtering, then slices the page: `items.slice((page-1)*pageSize, page*pageSize)`.

Concretely, replace the `const total = await ...count(...)` + paged `findMany` with a single unpaged `findMany`, and replace the trailing `return { items, total }` block:

```ts
    // Enrich the full filtered set (school count is bounded for an internal
    // tool), so risk-filter + computed sorts are correct, then paginate in JS.
    const total = await ctx.db.school.count({ where }); // pre-risk total (for reference)
    void total;
    const schools = await ctx.db.school.findMany({
      where,
      orderBy: dbOrderBy,
      select: {
        id: true, name: true, subdomain: true, createdAt: true,
        tenantId: true, tenant: { select: { name: true, status: true } },
      },
    });
    const ids = schools.map((s) => s.id);
    if (ids.length === 0) return { items: [], total: 0 };
```

…and at the end:

```ts
    if (input.risk !== "ALL") items = items.filter((i) => i.health === input.risk);
    if (input.sort === "students") items.sort((a, b) => b.activeStudents - a.activeStudents);
    if (input.sort === "classes30d") items.sort((a, b) => b.classes30d - a.classes30d);

    const filteredTotal = items.length;
    const paged = items.slice((input.page - 1) * input.pageSize, input.page * input.pageSize);
    return { items: paged, total: filteredTotal };
```

(Remove the now-unused pre-risk `total`/`void total` lines — they were only shown to mark what's being replaced. The final code computes `total` from the filtered length.)

- [ ] **Step 4: Run tests + gates**

Run: `pnpm vitest run tests/admin-portfolio.test.ts && pnpm type-check && pnpm lint`
Expected: green.

- [ ] **Step 5: Checkpoint**

Commit message: `fix(admin): correct overview risk-filter + computed-sort pagination`

---

### Task 4: Cross-tenant user lookup

**Files:**
- Modify: `src/lib/validations/admin.ts`, `src/server/routers/admin/support.ts`
- Create: `src/app/platform-admin/lookup/page.tsx`, `src/app/platform-admin/lookup/_components/user-lookup.tsx`
- Modify: `src/app/platform-admin/_components/portfolio-overview.tsx` (header link)
- Test: `tests/admin-lookup.test.ts`

**Interfaces:**
- Produces: `admin.support.lookupUser({ email }) → { found: boolean, user?: { userId, name, email, createdAt }, memberships: { tenantId, tenantName, tenantStatus, schoolName, role, status, lastSeenAt }[] }`. Audits `user.lookup` (targetType `"user"`) when a user is found. Fail-closed audit.
- Schema: `supportLookupSchema = { email }`.

- [ ] **Step 1: Add the schema**

Append to `src/lib/validations/admin.ts`:

```ts
export const supportLookupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/admin-lookup.test.ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createCallerFactory, type TRPCContext } from "@/server/trpc";
import { appRouter } from "@/server/routers/_app";
import { createTestTenant, cleanupTenants, type TestTenant } from "./helpers/tenant";

const createCaller = createCallerFactory(appRouter);
function adminCaller(email = "op@convlyx.com"): ReturnType<typeof createCaller> {
  const ctx: TRPCContext = { db, tenantId: null, ip: null, user: { id: "op" }, userEmail: email, loadMembership: async () => null };
  return createCaller(ctx);
}

const original = process.env.PLATFORM_ADMIN_EMAILS;
let a: TestTenant;
let studentEmail: string;
beforeAll(async () => {
  process.env.PLATFORM_ADMIN_EMAILS = "op@convlyx.com";
  a = await createTestTenant("LK");
  const u = await db.user.findUnique({ where: { id: a.studentUserId }, select: { email: true } });
  studentEmail = u!.email;
});
afterAll(async () => {
  if (original === undefined) delete process.env.PLATFORM_ADMIN_EMAILS;
  else process.env.PLATFORM_ADMIN_EMAILS = original;
  await cleanupTenants(a.tenantId);
});

describe("admin.support.lookupUser", () => {
  it("finds a user and their memberships, and audits", async () => {
    const res = await adminCaller().admin.support.lookupUser({ email: studentEmail });
    expect(res.found).toBe(true);
    expect(res.user?.userId).toBe(a.studentUserId);
    expect(res.memberships.some((m) => m.tenantId === a.tenantId && m.role === "STUDENT")).toBe(true);
    const audits = await db.auditLog.findMany({ where: { action: "user.lookup", targetId: a.studentUserId } });
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });
  it("returns found:false for an unknown email (no audit)", async () => {
    const res = await adminCaller().admin.support.lookupUser({ email: "nobody-xyz@nowhere.test" });
    expect(res.found).toBe(false);
    expect(res.memberships).toEqual([]);
  });
});
```

- [ ] **Step 3: Run to verify fail**

Run: `pnpm vitest run tests/admin-lookup.test.ts`
Expected: FAIL — `lookupUser` undefined.

- [ ] **Step 4: Implement `lookupUser`**

Add to `supportRouter` in `src/server/routers/admin/support.ts` (import `supportLookupSchema`):

```ts
  lookupUser: adminProcedure.input(supportLookupSchema).query(async ({ ctx, input }) => {
    const user = await ctx.db.user.findUnique({
      where: { email: input.email },
      select: {
        id: true, name: true, email: true, createdAt: true,
        memberships: {
          select: {
            role: true, status: true, lastSeenAt: true,
            tenant: { select: { id: true, name: true, status: true } },
            school: { select: { name: true } },
          },
          orderBy: { tenant: { name: "asc" } },
        },
      },
    });

    if (!user) return { found: false as const, memberships: [] as never[] };

    await ctx.audit({
      action: "user.lookup",
      targetType: "user",
      targetId: user.id,
      metadata: { email: user.email },
      strict: true,
    });

    return {
      found: true as const,
      user: { userId: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
      memberships: user.memberships.map((m) => ({
        tenantId: m.tenant.id,
        tenantName: m.tenant.name,
        tenantStatus: m.tenant.status,
        schoolName: m.school.name,
        role: m.role,
        status: m.status,
        lastSeenAt: m.lastSeenAt,
      })),
    };
  }),
```

- [ ] **Step 5: Run tests + gates**

Run: `pnpm vitest run tests/admin-lookup.test.ts && pnpm type-check && pnpm lint`
Expected: green.

- [ ] **Step 6: Lookup page + client**

```tsx
// src/app/platform-admin/lookup/_components/user-lookup.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, UserSearch } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { DataTableCard } from "@/components/data-table-card";
import { PiiNotice } from "../../_components/pii-notice";
import { formatDate } from "../../_components/admin-format";

const ROLE_LABEL: Record<string, string> = { ADMIN: "Admin", SECRETARY: "Secretaria", INSTRUCTOR: "Instrutor", STUDENT: "Aluno" };

export function UserLookup() {
  const [input, setInput] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const q = trpc.admin.support.lookupUser.useQuery(
    { email: email ?? "" },
    { enabled: !!email, refetchOnWindowFocus: false, staleTime: 5 * 60_000 },
  );

  const isEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.trim());

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Link href="/platform-admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Visão geral
      </Link>
      <PageHeader title="Procurar utilizador" description="Encontre um utilizador por email em todos os grupos." />
      <PiiNotice />

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => { e.preventDefault(); if (isEmail) setEmail(input.trim().toLowerCase()); }}
      >
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={input} onChange={(e) => setInput(e.target.value)} type="email" placeholder="email@exemplo.pt" className="w-[280px] pl-8" aria-label="Email do utilizador" />
        </div>
        <Button type="submit" disabled={!isEmail}>Procurar</Button>
      </form>

      {email && q.isLoading && <Skeleton className="h-40 w-full rounded-xl" />}
      {email && !q.isLoading && q.data && !q.data.found && (
        <EmptyState icon={UserSearch} message="Nenhum utilizador com esse email." />
      )}
      {q.data?.found && q.data.user && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{q.data.user.name}</h2>
            <p className="text-sm text-muted-foreground">{q.data.user.email} · conta desde {formatDate(q.data.user.createdAt)}</p>
          </div>
          <DataTableCard>
            <Table>
              <caption className="sr-only">Pertenças do utilizador</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Escola</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Grupo ativo?</TableHead>
                  <TableHead>Última atividade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.memberships.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      <Link href={`/platform-admin/tenants/${m.tenantId}`} className="hover:underline">{m.tenantName}</Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.schoolName}</TableCell>
                    <TableCell>{ROLE_LABEL[m.role] ?? m.role}</TableCell>
                    <TableCell>{m.status === "ACTIVE" ? <span className="text-success">Ativo</span> : <span className="text-muted-foreground">Inativo</span>}</TableCell>
                    <TableCell>{m.tenantStatus === "ACTIVE" ? "Sim" : <Badge variant="destructive">Suspenso</Badge>}</TableCell>
                    <TableCell className="text-muted-foreground">{m.lastSeenAt ? formatDate(m.lastSeenAt) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTableCard>
        </div>
      )}
    </div>
  );
}
```

```tsx
// src/app/platform-admin/lookup/page.tsx
import { UserLookup } from "./_components/user-lookup";

export const dynamic = "force-dynamic";

export default function LookupPage() {
  return <UserLookup />;
}
```

- [ ] **Step 7: Add a header link on the overview**

In `src/app/platform-admin/_components/portfolio-overview.tsx`, add a "Procurar utilizador" link button in the `PageHeader` actions (alongside "Criar / gerir" and "Auditoria"). Add `UserSearch` to the lucide import and:

```tsx
        <Link href="/platform-admin/lookup">
          <Button variant="outline" size="sm" className="gap-1.5">
            <UserSearch className="h-3.5 w-3.5" aria-hidden="true" />
            Procurar utilizador
          </Button>
        </Link>
```

- [ ] **Step 8: Gates + build**

Run: `pnpm type-check && pnpm lint && pnpm build`
Expected: clean; `/platform-admin/lookup` compiles.

- [ ] **Step 9: Checkpoint**

Commit message: `feat(admin): cross-tenant user lookup by email (audited)`

---

### Task 5: Admin password reset (recovery link)

**Files:**
- Modify: `src/lib/validations/admin.ts`, `src/server/routers/admin/ops.ts`, `src/app/platform-admin/tenants/[tenantId]/_components/account-detail.tsx`
- Test: extend `tests/admin-ops.test.ts` (guard only — the Supabase call is manually verified in prod, consistent with the existing `api/platform-admin/admins` route which is also not unit-tested)

**Interfaces:**
- Produces: `admin.ops.sendPasswordReset({ membershipId }) → { link: string }`. Resolves the membership's user email + school subdomain, mints a Supabase recovery link (service role) with `redirectTo` = that school's `/update-password`, audits `admin.password_reset` (targetType `"user"`), returns the link for the operator to relay.
- Schema: `resetPasswordSchema = { membershipId }`.

**Design note (decision):** the mutation returns a **copyable recovery link** rather than relying on Supabase to email it — immediate and independent of SMTP/deliverability, which is what an operator needs mid-support. The link is short-lived (Supabase recovery expiry) and only shown to the authenticated operator. If you'd rather email the user directly, swap `generateLink` for `resetPasswordForEmail` later — the surrounding guard + audit stay identical.

- [ ] **Step 1: Add the schema**

Append to `src/lib/validations/admin.ts`:

```ts
export const resetPasswordSchema = z.object({ membershipId: z.string().uuid() });
```

- [ ] **Step 2: Write the guard test (append to `tests/admin-ops.test.ts`)**

```ts
describe("admin.ops.sendPasswordReset (guards)", () => {
  it("throws NOT_FOUND for an unknown membership", async () => {
    await expect(
      adminCaller().admin.ops.sendPasswordReset({ membershipId: "00000000-0000-0000-0000-000000000000" }),
    ).rejects.toThrow();
  });
  it("rejects a non-operator", async () => {
    const ctx = { db, tenantId: null, ip: null, user: { id: "x" }, userEmail: "nope@x.com", loadMembership: async () => null };
    // @ts-expect-error minimal ctx
    await expect(createCaller(ctx).admin.ops.sendPasswordReset({ membershipId: a.adminMembershipId ?? "00000000-0000-0000-0000-000000000000" })).rejects.toThrow();
  });
});
```

(The happy path hits Supabase Auth and is verified manually in prod — do not assert it here.)

- [ ] **Step 3: Run to verify fail**

Run: `pnpm vitest run tests/admin-ops.test.ts`
Expected: FAIL — `sendPasswordReset` undefined.

- [ ] **Step 4: Implement `sendPasswordReset`**

In `src/server/routers/admin/ops.ts`, add the Supabase service-role client (mirror `api/platform-admin/admins/route.ts`) and the mutation. Add imports:

```ts
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { resetPasswordSchema } from "@/lib/validations/admin";
```

At module scope:

```ts
const supabaseAdmin = createSupabaseAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
```

Add to `opsRouter`:

```ts
  sendPasswordReset: adminProcedure.input(resetPasswordSchema).mutation(async ({ ctx, input }) => {
    const m = await ctx.db.membership.findUnique({
      where: { id: input.membershipId },
      select: { userId: true, role: true, user: { select: { email: true } }, school: { select: { subdomain: true } } },
    });
    if (!m) throw new TRPCError({ code: "NOT_FOUND", message: "errors.notFound" });

    const redirectTo = `https://${m.school.subdomain}.convlyx.com/update-password`;
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: m.user.email,
      options: { redirectTo },
    });
    if (error || !data?.properties?.action_link) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "errors.unexpected" });
    }

    await ctx.audit({
      action: "admin.password_reset",
      targetType: "user",
      targetId: m.userId,
      metadata: { email: m.user.email, role: m.role },
    });

    return { link: data.properties.action_link };
  }),
```

- [ ] **Step 5: Run tests + gates**

Run: `pnpm vitest run tests/admin-ops.test.ts && pnpm type-check && pnpm lint`
Expected: guard tests PASS; type-check + lint clean.

- [ ] **Step 6: Wire a "Repor palavra-passe" action into the staff table**

In `account-detail.tsx`, add a mutation + a per-staff-row button that, on success, shows the recovery link in a dialog with a copy button. Add near the other mutations:

```tsx
  const [resetLink, setResetLink] = useState<string | null>(null);
  const resetPw = trpc.admin.ops.sendPasswordReset.useMutation({
    onSuccess: (r) => setResetLink(r.link),
    onError: () => toast.error("Erro ao gerar ligação"),
  });
```

Add `useState` to the React import. In the staff row "Ações" cell, add before/after the activate/deactivate button:

```tsx
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={resetPw.isPending}
                        onClick={() => resetPw.mutate({ membershipId: m.membershipId })}
                      >
                        Repor palavra-passe
                      </Button>
```

And render a result dialog once (outside the table, e.g. at the end of the component before the closing `</div>`), reusing the Dialog primitives:

```tsx
      <Dialog open={resetLink !== null} onOpenChange={(o) => { if (!o) setResetLink(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ligação de reposição</DialogTitle></DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">Envie esta ligação ao utilizador. É temporária e permite definir uma nova palavra-passe.</p>
            <div className="mt-3 flex items-center gap-2">
              <Input readOnly value={resetLink ?? ""} className="flex-1 font-mono text-xs" aria-label="Ligação de reposição" />
              <Button variant="outline" size="sm" onClick={() => { if (resetLink) navigator.clipboard.writeText(resetLink); toast.success("Copiado"); }}>Copiar</Button>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setResetLink(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

Add the imports at the top of `account-detail.tsx`:

```tsx
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from "@/components/ui/dialog";
```

- [ ] **Step 7: Gates + build**

Run: `pnpm type-check && pnpm lint && pnpm build`
Expected: clean; account route compiles.

- [ ] **Step 8: Checkpoint**

Commit message: `feat(admin): reset a staff member's password via recovery link`

---

## Self-Review

**Coverage (Tier 1 + Tier 2 from the review):**
- T1 fail-closed audit → Task 1. T1 audit viewer (pagination + target + date) → Task 2.
- T2 admin password reset → Task 5. T2 cross-tenant user lookup → Task 4. T2 overview risk-filter accuracy → Task 3.

**Placeholder scan:** No TBD/TODO. Every code step is complete. Task 3 Step 3 shows a `void total` marker line but explicitly instructs to remove it in the final code and gives the final `return`.

**Type consistency:** `audit()` `strict` flag is used identically in Task 1 (support) and Task 4 (`user.lookup`). `buildAuditWhere` input keys (`action`/`actor`/`target`/`sinceDays`) match the audit page's usage and the test. `lookupUser` return shape (`found`/`user`/`memberships[]` with `tenantId`/`tenantName`/`tenantStatus`/`schoolName`/`role`/`status`/`lastSeenAt`) matches the lookup UI table. `sendPasswordReset` input (`membershipId`) + return (`{ link }`) match the account-detail mutation + dialog. New audit verbs: `user.lookup`, `admin.password_reset`.

**One test-fixture note:** Task 5 Step 2's second assertion references `a.adminMembershipId`, which `TestTenant` doesn't expose — it falls back to a zero UUID via `??`, so the test still exercises the non-operator rejection correctly without needing that field. (The `@ts-expect-error` covers the minimal ctx.) If preferred, drop that line and keep only the NOT_FOUND guard test.

# Admin Insights Core — Implementation Plan (Sub-project 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `admin.convlyx.com` from a create-only MVP into an insights console: a portfolio overview across all schools (searchable, sortable, health-flagged) and a per-tenant/school deep-dive page, on a formalized, audited platform-admin tRPC layer with lightweight activity tracking.

**Architecture:** Add one `requirePlatformAdmin()` helper (removes the 4× duplicated email-allowlist), an `adminProcedure` + `admin` tRPC router that runs cross-tenant on the **raw** (un-scoped) Prisma client and is the single audited choke point, and a throttled `lastSeenAt` heartbeat on `Membership`. Two Server-Component pages SSR-prefetch admin queries and reuse the existing analytics house style (`ChartCard`, `StatCard`, Recharts, `use-url-param`, offset pagination). Aggregates + staff contacts only — no individual student PII in this sub-project.

**Tech Stack:** Next.js 16 App Router, tRPC v11, Prisma 7 (+ pg adapter), Zod v4, Recharts 3, Tailwind v4, Supabase Auth, Vitest 4.

## Global Constraints

- **Package manager: `pnpm`** (npm crashes on this dep tree). All commands use `pnpm`.
- **Git is user-driven.** Do NOT run `git add`/`commit`. Each "Checkpoint" step states the commit message for the user to run; leave the working tree staged-in-spirit but uncommitted.
- **Internal operator UI is non-i18n** — hardcoded Portuguese, consistent with the existing `src/app/platform-admin/` area. Do NOT add keys to `messages/pt-PT.json` for admin surfaces.
- **Cross-tenant reads use raw `db`** (`@/server/db`), never the tenant-scoped client. `Tenant`/`AuditLog` are un-scoped; other models are read cross-tenant deliberately inside `adminProcedure`.
- **Aggregates only, no student PII** in every query in this sub-project. Staff (ADMIN/SECRETARY/INSTRUCTOR) contact info is allowed; students are counts only.
- **Region pinning:** any new route handler exports `export const preferredRegion = "dub1"`. (tRPC procedures inherit the existing `/api/trpc` handler's pinning — no change needed there.)
- **Validation:** Zod schemas import from `"zod/v4"` (matches `src/lib/validations/*`).
- **Zero-tolerance gates:** `pnpm type-check` **and** `pnpm lint` must both pass before any task is considered done (both gate CI).
- **UTC day-boundary helpers** for time bucketing mirror `src/server/routers/analytics.ts` (`subDaysUTC`, `startOfDayUTC`, `mondayOfUTC`, `bucketKey`) — reuse that approach; do not reinvent locale-aware bucketing.

---

## File Structure

**Create:**
- `src/server/lib/platform-admin.ts` — allowlist parsing + `isPlatformAdmin` + `requirePlatformAdmin`
- `src/server/lib/admin-health.ts` — `classifySchoolHealth()` + tunable thresholds
- `src/server/lib/heartbeat.ts` — `shouldHeartbeat()` pure throttle + `recordHeartbeat()` writer
- `src/server/admin-ssr.ts` — `getAdminSsrHelpers()` (admin-context SSR prefetch)
- `src/lib/validations/admin.ts` — Zod inputs for admin router
- `src/server/routers/admin/index.ts` — `adminRouter` (merges sub-routers)
- `src/server/routers/admin/portfolio.ts` — overview list, KPIs, trends
- `src/server/routers/admin/account.ts` — per-account get, charts, timeline
- `src/app/platform-admin/_components/health-badge.tsx` — shared health pill
- `src/app/platform-admin/_components/portfolio-overview.tsx` — overview client UI
- `src/app/platform-admin/tenants/[tenantId]/page.tsx` — account page (server)
- `src/app/platform-admin/tenants/[tenantId]/_components/account-detail.tsx` — account client UI
- Tests: `tests/platform-admin.test.ts`, `tests/heartbeat.test.ts`, `tests/admin-health.test.ts`, `tests/admin-portfolio.test.ts`, `tests/admin-account.test.ts`

**Modify:**
- `src/server/trpc.ts` — add `userEmail` to context, extend `MembershipContext` with `lastSeenAt`, add `adminProcedure`, fire heartbeat in `protectedProcedure`
- `src/server/ssr.ts` — set `userEmail: null` in the tenant SSR ctx (type conformance)
- `src/server/routers/_app.ts` — mount `admin`
- `src/app/platform-admin/layout.tsx` + `src/app/api/platform-admin/{tenants,schools,admins}/route.ts` — use the new helper
- `prisma/schema.prisma` — add `Membership.lastSeenAt` + index
- `src/app/platform-admin/page.tsx` — replace body with the overview page

---

# PHASE 0 — Foundation

### Task 1: `requirePlatformAdmin()` helper + de-duplicate the allowlist

**Files:**
- Create: `src/server/lib/platform-admin.ts`
- Test: `tests/platform-admin.test.ts`
- Modify: `src/app/platform-admin/layout.tsx`, `src/app/api/platform-admin/tenants/route.ts`, `src/app/api/platform-admin/schools/route.ts`, `src/app/api/platform-admin/admins/route.ts`

**Interfaces:**
- Produces: `parsePlatformAdminEmails(raw?: string): string[]`, `isPlatformAdmin(email: string | null | undefined): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// tests/platform-admin.test.ts
import { describe, it, expect } from "vitest";
import { parsePlatformAdminEmails, isPlatformAdmin } from "@/server/lib/platform-admin";

describe("parsePlatformAdminEmails", () => {
  it("splits, trims, lowercases and drops blanks", () => {
    expect(parsePlatformAdminEmails(" A@x.com, b@Y.com ,, ")).toEqual(["a@x.com", "b@y.com"]);
  });
  it("returns [] for undefined/empty", () => {
    expect(parsePlatformAdminEmails(undefined)).toEqual([]);
    expect(parsePlatformAdminEmails("")).toEqual([]);
  });
});

describe("isPlatformAdmin", () => {
  const emails = "admin@convlyx.com";
  it("matches case-insensitively", () => {
    expect(isPlatformAdmin("Admin@Convlyx.com", emails)).toBe(true);
  });
  it("rejects non-members and null", () => {
    expect(isPlatformAdmin("nope@x.com", emails)).toBe(false);
    expect(isPlatformAdmin(null, emails)).toBe(false);
    expect(isPlatformAdmin(undefined, emails)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/platform-admin.test.ts`
Expected: FAIL — cannot find module `@/server/lib/platform-admin`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/server/lib/platform-admin.ts
import { redirect } from "next/navigation";
import type { createClient } from "@/lib/supabase/server";

/** Parse the PLATFORM_ADMIN_EMAILS env var into a normalized allowlist. */
export function parsePlatformAdminEmails(raw = process.env.PLATFORM_ADMIN_EMAILS): string[] {
  return (raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Is this email on the platform-admin allowlist? Case-insensitive. */
export function isPlatformAdmin(
  email: string | null | undefined,
  raw?: string,
): boolean {
  if (!email) return false;
  return parsePlatformAdminEmails(raw).includes(email.toLowerCase());
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Server-Component/route guard: returns the authenticated platform-admin's
 * email, or performs the redirect side effect and never returns. Signs the
 * user out if they're logged in but not an operator (prevents a confusing
 * "logged in but bounced" loop).
 */
export async function requirePlatformAdmin(supabase: SupabaseServerClient): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isPlatformAdmin(user.email)) {
    await supabase.auth.signOut();
    redirect("/login");
  }
  return user.email!.toLowerCase();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/platform-admin.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Refactor the 4 call-sites onto the helper**

In `src/app/platform-admin/layout.tsx` — delete the local `ADMIN_EMAILS` const (line 5) and the inline checks; replace the body's auth block:

```tsx
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/server/lib/platform-admin";
import { AdminLogout } from "./_components/admin-logout";

export default async function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  await requirePlatformAdmin(supabase); // redirects if not an operator
  // ...unchanged header/main shell...
}
```

In each of `src/app/api/platform-admin/{tenants,schools,admins}/route.ts` — delete the local `ADMIN_EMAILS` const and replace the `verifyPlatformAdmin()` helper body with:

```ts
import { isPlatformAdmin } from "@/server/lib/platform-admin";

async function verifyPlatformAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return isPlatformAdmin(user?.email) ? user : null;
}
```

(Keep `verifyPlatformAdmin` returning the `user` object — callers use `admin.email`.)

- [ ] **Step 6: Verify gates**

Run: `pnpm type-check && pnpm lint`
Expected: both clean.

- [ ] **Step 7: Checkpoint**

Commit message for the user:
`refactor(admin): extract requirePlatformAdmin helper, drop 4x allowlist dup`

---

### Task 2: `lastSeenAt` heartbeat — schema, throttle, wiring

**Files:**
- Modify: `prisma/schema.prisma`, `src/server/trpc.ts`, `src/server/ssr.ts`
- Create: `src/server/lib/heartbeat.ts`, `tests/heartbeat.test.ts`

**Interfaces:**
- Produces: `HEARTBEAT_INTERVAL_MS: number`, `shouldHeartbeat(lastSeenAt: Date | null, now: Date): boolean`, `recordHeartbeat(db: PrismaClient, userId: string, tenantId: string, lastSeenAt: Date | null): Promise<void>`
- Consumes (by later tasks): `Membership.lastSeenAt` column.

- [ ] **Step 1: Add the schema field + index**

In `prisma/schema.prisma`, `Membership` model — add after `novidadesSeenAt`:

```prisma
  lastSeenAt   DateTime? @map("last_seen_at")
```

And add to the model's index block:

```prisma
  @@index([tenantId, lastSeenAt])
```

- [ ] **Step 2: Generate + apply the migration**

Run: `pnpm db:migrate -- --name add_membership_last_seen_at`
Expected: new folder under `prisma/migrations/`, applied to dev DB, client regenerated. Confirm the generated `.sql` adds the column + index and nothing else.

- [ ] **Step 3: Write the failing throttle test**

```ts
// tests/heartbeat.test.ts
import { describe, it, expect } from "vitest";
import { shouldHeartbeat, HEARTBEAT_INTERVAL_MS } from "@/server/lib/heartbeat";

describe("shouldHeartbeat", () => {
  const now = new Date("2026-07-13T12:00:00.000Z");
  it("fires when never seen", () => {
    expect(shouldHeartbeat(null, now)).toBe(true);
  });
  it("skips within the throttle window", () => {
    const recent = new Date(now.getTime() - (HEARTBEAT_INTERVAL_MS - 1000));
    expect(shouldHeartbeat(recent, now)).toBe(false);
  });
  it("fires once past the window", () => {
    const stale = new Date(now.getTime() - (HEARTBEAT_INTERVAL_MS + 1000));
    expect(shouldHeartbeat(stale, now)).toBe(true);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm vitest run tests/heartbeat.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement heartbeat**

```ts
// src/server/lib/heartbeat.ts
import type { PrismaClient } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";

/** Update lastSeenAt at most once per hour per active membership. */
export const HEARTBEAT_INTERVAL_MS = 60 * 60 * 1000;

/** Pure throttle decision — tested in isolation. */
export function shouldHeartbeat(lastSeenAt: Date | null, now: Date): boolean {
  if (!lastSeenAt) return true;
  return now.getTime() - lastSeenAt.getTime() >= HEARTBEAT_INTERVAL_MS;
}

/**
 * Fire-and-forget activity write. Never awaited on the request path and never
 * throws — a failed heartbeat must not affect the user's request. Uses the raw
 * db with an explicit (userId, tenantId) filter; updateMany avoids the
 * findUnique restriction on tenant-scoped models.
 */
export async function recordHeartbeat(
  db: PrismaClient,
  userId: string,
  tenantId: string,
  lastSeenAt: Date | null,
): Promise<void> {
  const now = new Date();
  if (!shouldHeartbeat(lastSeenAt, now)) return;
  try {
    await db.membership.updateMany({
      where: { userId, tenantId },
      data: { lastSeenAt: now },
    });
  } catch (error) {
    logger.warn("heartbeat write failed", { error, userId, tenantId });
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run tests/heartbeat.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Extend context + wire the heartbeat in `protectedProcedure`**

In `src/server/trpc.ts`:

(a) Add `lastSeenAt` to `MembershipContext`:

```ts
type MembershipContext = {
  role: UserRole;
  schoolId: string;
  tenantId: string;
  status: UserStatus;
  lastSeenAt: Date | null;
};
```

(b) Add `userEmail` to `TRPCContext`:

```ts
export type TRPCContext = {
  db: typeof db;
  tenantId: string | null;
  ip: string | null;
  user: { id: string } | null;
  userEmail: string | null;
  loadMembership: () => Promise<MembershipContext | null>;
};
```

(c) In `createTRPCContext`: the unauthenticated early return adds `userEmail: null`; the authenticated return adds `userEmail: authUser.email ?? null`; and the membership `select` adds `lastSeenAt: true`:

```ts
      membershipPromise = db.membership.findFirst({
        where: { userId, tenantId },
        select: { role: true, schoolId: true, tenantId: true, status: true, lastSeenAt: true },
      });
```

(d) In `protectedProcedure`, after the ACTIVE-membership check passes and before `return next(...)`, fire the heartbeat (not awaited):

```ts
  // Lightweight activity signal for the admin console. Throttled to ≤1 write/hr
  // per membership and never awaited — zero added request latency.
  void recordHeartbeat(ctx.db, ctx.user.id, membership.tenantId, membership.lastSeenAt);
```

Add the import: `import { recordHeartbeat } from "./lib/heartbeat";`

- [ ] **Step 8: Fix the tenant SSR context type**

In `src/server/ssr.ts`, the `ctx` object gains `userEmail: null` and the inline `loadMembership` return adds `lastSeenAt: null`:

```ts
  const ctx: TRPCContext = {
    db,
    tenantId: user?.tenantId ?? null,
    ip: null,
    user: user ? { id: user.id } : null,
    userEmail: null,
    loadMembership: async () =>
      user
        ? { role: user.role, schoolId: user.schoolId, tenantId: user.tenantId, status: "ACTIVE", lastSeenAt: null }
        : null,
  };
```

Also update `tests/helpers/tenant.ts` `testLoadMembership` select + the inline `createCaller` ctx to include the new fields:
- add `lastSeenAt: true` to the `select` in `testLoadMembership`
- add `userEmail: null` to the `createCaller({ ... })` ctx object.

- [ ] **Step 9: Verify gates + full suite**

Run: `pnpm type-check && pnpm lint && pnpm vitest run`
Expected: all green (existing tests still pass with the widened context type).

- [ ] **Step 10: Checkpoint**

Commit message: `feat(admin): add throttled lastSeenAt heartbeat + userEmail in ctx`

---

### Task 3: `adminProcedure` + audited cross-tenant context

**Files:**
- Modify: `src/server/trpc.ts`
- Test: covered by Task 5's router smoke test (`tests/admin-portfolio.test.ts` setup) — no standalone test here since a bare procedure has no endpoint until the router mounts.

**Interfaces:**
- Produces: `adminProcedure` — a procedure whose `ctx` adds `actorEmail: string` and `audit(params)` bound to the raw db + operator email; runs on raw (un-scoped) `ctx.db`.

- [ ] **Step 1: Implement `adminProcedure`**

In `src/server/trpc.ts`, add the `audit` import and the procedure at the end of the file:

```ts
import { audit } from "./lib/audit";

/**
 * Platform-admin procedure — authorized purely by the PLATFORM_ADMIN_EMAILS
 * allowlist (see requirePlatformAdmin's rationale). Runs on the RAW db
 * (cross-tenant; Tenant/AuditLog are un-scoped and other models are read
 * cross-tenant deliberately here). Every mutation / PII read must call
 * `ctx.audit(...)` — this is the single audited choke point for operator access.
 */
export const adminProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user || !isPlatformAdmin(ctx.userEmail)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "auth.notAuthenticated" });
  }
  const actorEmail = ctx.userEmail!;
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      actorEmail,
      audit: (params: {
        action: string;
        targetType: string;
        targetId: string;
        metadata?: Record<string, unknown>;
      }) => audit({ db: ctx.db, actorEmail, ...params }),
    },
  });
});
```

Add the import at the top: `import { isPlatformAdmin } from "./lib/platform-admin";`

- [ ] **Step 2: Verify gates**

Run: `pnpm type-check && pnpm lint`
Expected: clean. (Unused-export warning is fine; Task 5 consumes it.)

- [ ] **Step 3: Checkpoint**

Commit message: `feat(admin): add adminProcedure (allowlist-gated, raw db, auto-audit)`

---

### Task 4: `classifySchoolHealth()` heuristic

**Files:**
- Create: `src/server/lib/admin-health.ts`, `tests/admin-health.test.ts`

**Interfaces:**
- Produces:
  - `type SchoolHealth = "NEW" | "INACTIVE" | "AT_RISK" | "HEALTHY"`
  - `HEALTH_THRESHOLDS = { newDays: 21, quietDays: 14, dropWindowDays: 30, dropRatio: 0.6 }`
  - `classifySchoolHealth(input: { tenantActive: boolean; ageDays: number; daysSinceActivity: number | null; classesRecent: number; classesPrevious: number }): SchoolHealth`

- [ ] **Step 1: Write the failing test**

```ts
// tests/admin-health.test.ts
import { describe, it, expect } from "vitest";
import { classifySchoolHealth } from "@/server/lib/admin-health";

const base = { tenantActive: true, ageDays: 200, daysSinceActivity: 1, classesRecent: 40, classesPrevious: 42 };

describe("classifySchoolHealth", () => {
  it("INACTIVE when the tenant is inactive (overrides all)", () => {
    expect(classifySchoolHealth({ ...base, tenantActive: false })).toBe("INACTIVE");
  });
  it("NEW inside the new-account window", () => {
    expect(classifySchoolHealth({ ...base, ageDays: 10 })).toBe("NEW");
  });
  it("AT_RISK when quiet past the threshold", () => {
    expect(classifySchoolHealth({ ...base, daysSinceActivity: 20 })).toBe("AT_RISK");
  });
  it("AT_RISK when class volume dropped >=60% vs prior period", () => {
    expect(classifySchoolHealth({ ...base, classesRecent: 10, classesPrevious: 40 })).toBe("AT_RISK");
  });
  it("HEALTHY when active and steady", () => {
    expect(classifySchoolHealth(base)).toBe("HEALTHY");
  });
  it("no-activity (null) past new-window counts as quiet → AT_RISK", () => {
    expect(classifySchoolHealth({ ...base, daysSinceActivity: null, classesRecent: 0, classesPrevious: 0 })).toBe("AT_RISK");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/admin-health.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/server/lib/admin-health.ts

export type SchoolHealth = "NEW" | "INACTIVE" | "AT_RISK" | "HEALTHY";

/** Tunable in ONE place — revisit numbers once real data is in. */
export const HEALTH_THRESHOLDS = {
  newDays: 21,
  quietDays: 14,
  dropWindowDays: 30,
  dropRatio: 0.6,
} as const;

/**
 * Single source of truth for the health badge used on the overview and account
 * pages. Precedence: INACTIVE > NEW > AT_RISK > HEALTHY.
 * - daysSinceActivity: days since the most recent of {class created, check-in,
 *   lastSeenAt}; null means no activity recorded at all.
 * - classesRecent/Previous: classes created in the last vs prior dropWindowDays.
 */
export function classifySchoolHealth(input: {
  tenantActive: boolean;
  ageDays: number;
  daysSinceActivity: number | null;
  classesRecent: number;
  classesPrevious: number;
}): SchoolHealth {
  if (!input.tenantActive) return "INACTIVE";
  if (input.ageDays < HEALTH_THRESHOLDS.newDays) return "NEW";

  const quiet =
    input.daysSinceActivity == null || input.daysSinceActivity >= HEALTH_THRESHOLDS.quietDays;

  const dropped =
    input.classesPrevious > 0 &&
    input.classesRecent / input.classesPrevious <= 1 - HEALTH_THRESHOLDS.dropRatio;

  if (quiet || dropped) return "AT_RISK";
  return "HEALTHY";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/admin-health.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Checkpoint**

Commit message: `feat(admin): add school health classification heuristic`

---

### Task 5: `admin` router skeleton + mount + admin SSR helper

**Files:**
- Create: `src/server/routers/admin/index.ts`, `src/server/routers/admin/portfolio.ts` (with a `ping` placeholder query only for now), `src/server/admin-ssr.ts`
- Modify: `src/server/routers/_app.ts`
- Test: `tests/admin-portfolio.test.ts` (auth smoke test)

**Interfaces:**
- Consumes: `adminProcedure` (Task 3).
- Produces: `adminRouter` mounted at `admin`; `getAdminSsrHelpers()`; a caller pattern for admin tests (below).

- [ ] **Step 1: Router skeleton**

```ts
// src/server/routers/admin/portfolio.ts
import { router, adminProcedure } from "../../trpc";

export const portfolioRouter = router({
  // Placeholder to prove auth wiring; replaced by real queries in Phase 1.
  ping: adminProcedure.query(() => ({ ok: true as const })),
});
```

```ts
// src/server/routers/admin/index.ts
import { router } from "../../trpc";
import { portfolioRouter } from "./portfolio";

export const adminRouter = router({
  portfolio: portfolioRouter,
});
```

Mount in `src/server/routers/_app.ts`: import `{ adminRouter } from "./admin"` and add `admin: adminRouter,` to the `router({...})`.

- [ ] **Step 2: Admin SSR helper**

```ts
// src/server/admin-ssr.ts
import "server-only";
import { cache } from "react";
import { createServerSideHelpers } from "@trpc/react-query/server";
import superjson from "superjson";
import { db } from "@/server/db";
import { appRouter } from "@/server/routers/_app";
import { createClient } from "@/lib/supabase/server";
import type { TRPCContext } from "@/server/trpc";

/**
 * SSR helpers for platform-admin pages. Builds an admin tRPC context (userEmail
 * from Supabase; no tenant). Pair with `dehydrateSsr` from `@/server/ssr`.
 */
export const getAdminSsrHelpers = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ctx: TRPCContext = {
    db,
    tenantId: null,
    ip: null,
    user: user ? { id: user.id } : null,
    userEmail: user?.email ?? null,
    loadMembership: async () => null,
  };
  return createServerSideHelpers({ router: appRouter, ctx, transformer: superjson });
});
```

- [ ] **Step 3: Write the auth smoke test**

```ts
// tests/admin-portfolio.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/server/db";
import { createCallerFactory } from "@/server/trpc";
import { appRouter } from "@/server/routers/_app";
import type { TRPCContext } from "@/server/trpc";

const createCaller = createCallerFactory(appRouter);

/** Build an admin-context caller. When email is on the allowlist it passes adminProcedure. */
function adminCaller(userEmail: string | null): ReturnType<typeof createCaller> {
  const ctx: TRPCContext = {
    db,
    tenantId: null,
    ip: null,
    user: userEmail ? { id: "op-1" } : null,
    userEmail,
    loadMembership: async () => null,
  };
  return createCaller(ctx);
}

describe("adminProcedure auth", () => {
  const original = process.env.PLATFORM_ADMIN_EMAILS;
  beforeAll(() => { process.env.PLATFORM_ADMIN_EMAILS = "op@convlyx.com"; });
  afterAll(() => { process.env.PLATFORM_ADMIN_EMAILS = original; });

  it("allows an allowlisted operator", async () => {
    await expect(adminCaller("op@convlyx.com").admin.portfolio.ping()).resolves.toEqual({ ok: true });
  });
  it("rejects a non-allowlisted email", async () => {
    await expect(adminCaller("intruder@x.com").admin.portfolio.ping()).rejects.toThrow();
  });
  it("rejects unauthenticated", async () => {
    await expect(adminCaller(null).admin.portfolio.ping()).rejects.toThrow();
  });
});
```

- [ ] **Step 4: Run test**

Run: `pnpm vitest run tests/admin-portfolio.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify gates**

Run: `pnpm type-check && pnpm lint`
Expected: clean.

- [ ] **Step 6: Checkpoint**

Commit message: `feat(admin): mount admin tRPC router + admin SSR helper`

---

# PHASE 1 — Portfolio overview

### Task 6: `admin.portfolio.kpis` + `admin.portfolio.trends`

**Files:**
- Modify: `src/server/routers/admin/portfolio.ts`
- Create: `src/lib/validations/admin.ts`
- Test: extend `tests/admin-portfolio.test.ts`

**Interfaces:**
- Produces:
  - `admin.portfolio.kpis()` → `{ schools: number; activeMembers: number; classes30d: number; atRiskCount: number }`
  - `admin.portfolio.trends({ rangeDays })` → `{ granularity, newSchools: {bucket,count}[]; activity: {bucket, classes, enrolments}[] }`
  - `adminTrendsSchema` (Zod).

- [ ] **Step 1: Validation schema**

```ts
// src/lib/validations/admin.ts
import { z } from "zod/v4";

export const ADMIN_RANGE_DAYS = [30, 90, 365] as const;

export const adminTrendsSchema = z
  .object({
    rangeDays: z.union([z.literal(30), z.literal(90), z.literal(365)]).default(90),
  })
  .optional();

export const adminOverviewSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(120).optional(),
  status: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL"),
  risk: z.enum(["ALL", "HEALTHY", "AT_RISK", "NEW", "INACTIVE"]).default("ALL"),
  sort: z.enum(["name", "createdAt", "students", "classes30d"]).default("name"),
});

export const adminAccountSchema = z.object({ tenantId: z.string().uuid() });
export const adminAccountChartsSchema = z.object({
  tenantId: z.string().uuid(),
  schoolId: z.string().uuid().optional(),
  rangeDays: z.union([z.literal(30), z.literal(90), z.literal(365)]).default(90),
});
```

- [ ] **Step 2: Write failing tests (append to `tests/admin-portfolio.test.ts`)**

```ts
describe("admin.portfolio.kpis + trends", () => {
  // (Reuse the allowlist beforeAll/afterAll from the auth describe, or lift it
  // to the file top-level so both describes share it.)
  it("kpis returns non-negative counts including at-risk", async () => {
    const k = await adminCaller("op@convlyx.com").admin.portfolio.kpis();
    expect(k.schools).toBeGreaterThanOrEqual(0);
    expect(k.atRiskCount).toBeGreaterThanOrEqual(0);
  });
  it("trends returns aligned bucket arrays", async () => {
    const t = await adminCaller("op@convlyx.com").admin.portfolio.trends({ rangeDays: 90 });
    expect(["day", "week", "month"]).toContain(t.granularity);
    expect(Array.isArray(t.newSchools)).toBe(true);
    expect(Array.isArray(t.activity)).toBe(true);
  });
});
```

- [ ] **Step 3: Run to verify fail**

Run: `pnpm vitest run tests/admin-portfolio.test.ts`
Expected: FAIL — `kpis`/`trends` not a function.

- [ ] **Step 4: Implement the two queries**

Replace `src/server/routers/admin/portfolio.ts` (keep `ping`), adding shared UTC helpers copied from `analytics.ts` (`subDaysUTC`, `startOfDayUTC`, `mondayOfUTC`, `startOfMonthUTC`, `bucketKey`, `bucketKeysForRange`, `granularityFor` — import `granularityFor` from `@/lib/validations/analytics` and the bucket helpers by copying the small functions into a shared `src/server/lib/time-buckets.ts` if you prefer DRY; a shared module is the better call — extract them there and import from both `analytics.ts` and here):

```ts
import { router, adminProcedure } from "../../trpc";
import { adminTrendsSchema } from "@/lib/validations/admin";
import { classifySchoolHealth } from "../../lib/admin-health";
import {
  subDaysUTC, bucketKey, bucketKeysForRange, granularityFor,
} from "../../lib/time-buckets";

const DAY_MS = 86_400_000;

export const portfolioRouter = router({
  ping: adminProcedure.query(() => ({ ok: true as const })),

  kpis: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const since30 = subDaysUTC(now, 30);
    const prev30 = subDaysUTC(now, 60);
    const quietSince = subDaysUTC(now, 14);
    const newCutoff = subDaysUTC(now, 21);

    const [schools, activeMembers, classes30d, schoolRows, classAgg, checkinRows] =
      await Promise.all([
        ctx.db.school.count(),
        ctx.db.membership.count({ where: { status: "ACTIVE" } }),
        ctx.db.classSession.count({ where: { createdAt: { gte: since30 } } }),
        ctx.db.school.findMany({
          select: { id: true, createdAt: true, tenant: { select: { status: true } } },
        }),
        ctx.db.classSession.groupBy({
          by: ["schoolId"],
          where: { createdAt: { gte: prev30 } },
          _count: { _all: true },
        }),
        // most recent check-in per school (activity proxy)
        ctx.db.enrollment.groupBy({
          by: ["schoolId"],
          where: { checkedInAt: { not: null } },
          _max: { checkedInAt: true },
        }),
      ]);

    // recent vs previous class counts + last activity per school, then classify
    const recentBySchool = new Map<string, number>();
    const prevBySchool = new Map<string, number>();
    // classAgg counts everything since prev30; split needs two queries or a
    // findMany. Use a findMany of createdAt for correctness:
    const classDates = await ctx.db.classSession.findMany({
      where: { createdAt: { gte: prev30 } },
      select: { schoolId: true, createdAt: true },
    });
    for (const c of classDates) {
      const map = c.createdAt >= since30 ? recentBySchool : prevBySchool;
      map.set(c.schoolId, (map.get(c.schoolId) ?? 0) + 1);
    }
    const lastCheckin = new Map(checkinRows.map((r) => [r.schoolId, r._max.checkedInAt]));

    let atRiskCount = 0;
    for (const s of schoolRows) {
      const last = lastCheckin.get(s.id) ?? null;
      const daysSinceActivity = last ? Math.floor((now.getTime() - last.getTime()) / DAY_MS) : null;
      const health = classifySchoolHealth({
        tenantActive: s.tenant.status === "ACTIVE",
        ageDays: Math.floor((now.getTime() - s.createdAt.getTime()) / DAY_MS),
        daysSinceActivity,
        classesRecent: recentBySchool.get(s.id) ?? 0,
        classesPrevious: prevBySchool.get(s.id) ?? 0,
      });
      if (health === "AT_RISK") atRiskCount += 1;
    }
    // Silence unused var from the groupBy we kept for future use.
    void classAgg;

    return { schools, activeMembers, classes30d, atRiskCount };
  }),

  trends: adminProcedure.input(adminTrendsSchema).query(async ({ ctx, input }) => {
    const rangeDays = input?.rangeDays ?? 90;
    const granularity = granularityFor(rangeDays);
    const keys = bucketKeysForRange(rangeDays, granularity);
    const since = new Date(`${keys[0]}T00:00:00.000Z`);

    const [schools, classes, enrolments] = await Promise.all([
      ctx.db.school.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      ctx.db.classSession.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      ctx.db.enrollment.findMany({ where: { enrolledAt: { gte: since } }, select: { enrolledAt: true } }),
    ]);

    const newSchools = new Map(keys.map((k) => [k, 0]));
    for (const s of schools) {
      const k = bucketKey(s.createdAt, granularity);
      if (newSchools.has(k)) newSchools.set(k, newSchools.get(k)! + 1);
    }
    const activity = new Map(keys.map((k) => [k, { classes: 0, enrolments: 0 }]));
    for (const c of classes) {
      const k = bucketKey(c.createdAt, granularity);
      if (activity.has(k)) activity.get(k)!.classes += 1;
    }
    for (const e of enrolments) {
      const k = bucketKey(e.enrolledAt, granularity);
      if (activity.has(k)) activity.get(k)!.enrolments += 1;
    }

    return {
      granularity,
      newSchools: Array.from(newSchools, ([bucket, count]) => ({ bucket, count })),
      activity: Array.from(activity, ([bucket, v]) => ({ bucket, ...v })),
    };
  }),
});
```

- [ ] **Step 5: Extract shared time-bucket helpers**

Create `src/server/lib/time-buckets.ts` by moving `subDaysUTC`, `startOfDayUTC`, `mondayOfUTC`, `startOfMonthUTC`, `bucketKey`, `bucketKeysForRange` out of `src/server/routers/analytics.ts` into it (exported), then import them back into `analytics.ts`. Keep `granularityFor` where it is (`@/lib/validations/analytics`) but also re-export from `time-buckets.ts` for a single import site, or import both. Run `pnpm vitest run` afterward to confirm analytics tests (if any touch these) still pass.

- [ ] **Step 6: Run tests + gates**

Run: `pnpm vitest run tests/admin-portfolio.test.ts && pnpm type-check && pnpm lint`
Expected: green.

- [ ] **Step 7: Checkpoint**

Commit message: `feat(admin): portfolio kpis + trends queries`

---

### Task 7: `admin.portfolio.overview` (list with health, search, sort, paginate)

**Files:**
- Modify: `src/server/routers/admin/portfolio.ts`
- Test: extend `tests/admin-portfolio.test.ts`

**Interfaces:**
- Produces: `admin.portfolio.overview(input: z.infer<typeof adminOverviewSchema>)` →
  `{ items: OverviewRow[]; total: number }` where
  `OverviewRow = { schoolId, tenantId, schoolName, tenantName, subdomain, tenantStatus, ageDays, activeStudents, wau, classes30d, passRate: number | null, health: SchoolHealth, sparkline: number[] }`.

- [ ] **Step 1: Write the failing test**

```ts
it("overview paginates and returns health-annotated rows", async () => {
  const res = await adminCaller("op@convlyx.com").admin.portfolio.overview({
    page: 1, pageSize: 10, status: "ALL", risk: "ALL", sort: "name",
  });
  expect(res).toHaveProperty("total");
  expect(Array.isArray(res.items)).toBe(true);
  if (res.items.length) {
    const row = res.items[0];
    expect(row).toHaveProperty("health");
    expect(row).toHaveProperty("wau");
    expect(row.sparkline.length).toBe(8);
  }
});
it("search narrows results", async () => {
  const res = await adminCaller("op@convlyx.com").admin.portfolio.overview({
    page: 1, pageSize: 10, search: "zzz-no-such-school", status: "ALL", risk: "ALL", sort: "name",
  });
  expect(res.total).toBe(0);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm vitest run tests/admin-portfolio.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `overview`**

Add to `portfolioRouter`. Strategy: filter+page the schools first (cheap), then run grouped aggregates scoped to the page's `schoolId`s only.

```ts
  overview: adminProcedure.input(adminOverviewSchema).query(async ({ ctx, input }) => {
    const now = new Date();
    const since30 = subDaysUTC(now, 30);
    const prev30 = subDaysUTC(now, 60);
    const wauSince = subDaysUTC(now, 7);
    const sparkSince = subDaysUTC(now, 56); // 8 weeks

    // status filter maps to the parent tenant's status
    const tenantWhere =
      input.status === "ALL" ? {} : { tenant: { is: { status: input.status } } };
    const searchWhere = input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" as const } },
            { subdomain: { contains: input.search, mode: "insensitive" as const } },
          ],
        }
      : {};
    const where = { ...tenantWhere, ...searchWhere };

    // DB-sortable columns; students/classes30d are computed, so those sorts are
    // applied in JS after enrichment (page still bounded by pageSize).
    const dbOrderBy =
      input.sort === "createdAt" ? { createdAt: "desc" as const } : { name: "asc" as const };

    const total = await ctx.db.school.count({ where });
    const schools = await ctx.db.school.findMany({
      where,
      orderBy: dbOrderBy,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: {
        id: true, name: true, subdomain: true, createdAt: true,
        tenantId: true, tenant: { select: { name: true, status: true } },
      },
    });
    const ids = schools.map((s) => s.id);
    if (ids.length === 0) return { items: [], total };

    const [students, wau, classesRecent, classesPrev, passAgg, checkin, sparkRows] =
      await Promise.all([
        ctx.db.membership.groupBy({ by: ["schoolId"], where: { schoolId: { in: ids }, role: "STUDENT", status: "ACTIVE" }, _count: { _all: true } }),
        ctx.db.membership.groupBy({ by: ["schoolId"], where: { schoolId: { in: ids }, lastSeenAt: { gte: wauSince } }, _count: { _all: true } }),
        ctx.db.classSession.groupBy({ by: ["schoolId"], where: { schoolId: { in: ids }, createdAt: { gte: since30 } }, _count: { _all: true } }),
        ctx.db.classSession.groupBy({ by: ["schoolId"], where: { schoolId: { in: ids }, createdAt: { gte: prev30, lt: since30 } }, _count: { _all: true } }),
        ctx.db.exam.groupBy({ by: ["schoolId", "result"], where: { schoolId: { in: ids }, result: { in: ["PASSED", "FAILED", "NO_SHOW"] } }, _count: { _all: true } }),
        ctx.db.enrollment.groupBy({ by: ["schoolId"], where: { schoolId: { in: ids }, checkedInAt: { not: null } }, _max: { checkedInAt: true } }),
        ctx.db.enrollment.findMany({ where: { schoolId: { in: ids }, enrolledAt: { gte: sparkSince } }, select: { schoolId: true, enrolledAt: true } }),
      ]);

    const num = (rows: { schoolId: string; _count: { _all: number } }[]) =>
      new Map(rows.map((r) => [r.schoolId, r._count._all]));
    const students$ = num(students), wau$ = num(wau), rec$ = num(classesRecent), prev$ = num(classesPrev);
    const lastCheckin$ = new Map(checkin.map((r) => [r.schoolId, r._max.checkedInAt]));

    const passBySchool = new Map<string, { passed: number; total: number }>();
    for (const r of passAgg) {
      const b = passBySchool.get(r.schoolId) ?? { passed: 0, total: 0 };
      b.total += r._count._all;
      if (r.result === "PASSED") b.passed += r._count._all;
      passBySchool.set(r.schoolId, b);
    }

    // 8 weekly sparkline buckets of enrolments per school
    const weekIndex = (d: Date) => Math.min(7, Math.floor((d.getTime() - sparkSince.getTime()) / (7 * DAY_MS)));
    const spark = new Map<string, number[]>(ids.map((id) => [id, Array(8).fill(0)]));
    for (const r of sparkRows) {
      const arr = spark.get(r.schoolId)!;
      const i = weekIndex(r.enrolledAt);
      if (i >= 0 && i < 8) arr[i] += 1;
    }

    let items = schools.map((s) => {
      const last = lastCheckin$.get(s.id) ?? null;
      const daysSinceActivity = last ? Math.floor((now.getTime() - last.getTime()) / DAY_MS) : null;
      const classes30d = rec$.get(s.id) ?? 0;
      const pass = passBySchool.get(s.id);
      return {
        schoolId: s.id,
        tenantId: s.tenantId,
        schoolName: s.name,
        tenantName: s.tenant.name,
        subdomain: s.subdomain,
        tenantStatus: s.tenant.status,
        ageDays: Math.floor((now.getTime() - s.createdAt.getTime()) / DAY_MS),
        activeStudents: students$.get(s.id) ?? 0,
        wau: wau$.get(s.id) ?? 0,
        classes30d,
        passRate: pass && pass.total > 0 ? pass.passed / pass.total : null,
        health: classifySchoolHealth({
          tenantActive: s.tenant.status === "ACTIVE",
          ageDays: Math.floor((now.getTime() - s.createdAt.getTime()) / DAY_MS),
          daysSinceActivity,
          classesRecent: classes30d,
          classesPrevious: prev$.get(s.id) ?? 0,
        }),
        sparkline: spark.get(s.id) ?? Array(8).fill(0),
      };
    });

    if (input.risk !== "ALL") items = items.filter((i) => i.health === input.risk);
    if (input.sort === "students") items.sort((a, b) => b.activeStudents - a.activeStudents);
    if (input.sort === "classes30d") items.sort((a, b) => b.classes30d - a.classes30d);

    return { items, total };
  }),
```

Note the `risk` filter is applied post-enrichment on the current page only — acceptable for an internal tool (documented tradeoff). If exact risk-filtered totals matter later, promote health to a stored/materialized column.

- [ ] **Step 4: Run tests + gates**

Run: `pnpm vitest run tests/admin-portfolio.test.ts && pnpm type-check && pnpm lint`
Expected: green.

- [ ] **Step 5: Checkpoint**

Commit message: `feat(admin): portfolio overview list (health, search, sort, paginate)`

---

### Task 8: Portfolio overview page UI

**Files:**
- Create: `src/app/platform-admin/_components/health-badge.tsx`, `src/app/platform-admin/_components/portfolio-overview.tsx`
- Modify: `src/app/platform-admin/page.tsx`

**Interfaces:**
- Consumes: `admin.portfolio.{kpis,trends,overview}`, `getAdminSsrHelpers`, `dehydrateSsr`.

- [ ] **Step 1: Health badge (text + color + icon — never color alone)**

```tsx
// src/app/platform-admin/_components/health-badge.tsx
import { CircleCheck, CircleAlert, Sparkles, CircleSlash } from "lucide-react";
import type { SchoolHealth } from "@/server/lib/admin-health";

const MAP = {
  HEALTHY:  { label: "Saudável", cls: "text-success",         Icon: CircleCheck },
  AT_RISK:  { label: "Em risco", cls: "text-warning",         Icon: CircleAlert },
  NEW:      { label: "Novo",     cls: "text-info",            Icon: Sparkles },
  INACTIVE: { label: "Inativo",  cls: "text-muted-foreground", Icon: CircleSlash },
} as const;

export function HealthBadge({ health }: { health: SchoolHealth }) {
  const { label, cls, Icon } = MAP[health];
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${cls}`}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Overview client component**

Build `portfolio-overview.tsx` (`"use client"`). It:
- reads filters via `useUrlParamInt("page",1)`, `useDebouncedUrlParam("q","")`, `useUrlParam("status","ALL")`, `useUrlParam("risk","ALL")`, `useUrlParam("sort","name")`;
- calls the three queries with `keepPreviousData`;
- renders a `SnapshotRow`-style KPI grid (reuse `StatCard` from `@/components/stat-card` — the at-risk tile uses `text-warning`), two `ChartCard`s wrapping Recharts (copy the conventions from `src/app/(dashboard)/analytics/_components/enrolments-over-time.tsx`: `h-64`, `ResponsiveContainer`, `var(--*)` colors, `isAnimationActive={false}`, `aria-hidden` + a `SrDataTable` from `@/components/sr-data-table`), and a schools table (`Table` primitives inside `DataTableCard`) with an inline SVG sparkline per row and a `<HealthBadge>` cell, each row an `next/link` to `/platform-admin/tenants/${tenantId}`;
- pagination via `@/components/pagination` (`totalPages = Math.ceil(total / pageSize)`).

Full reference for the table row + sparkline (keep the rest matching the analytics page idioms):

```tsx
function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 60},${20 - (v / max) * 18}`).join(" ");
  return (
    <svg width="60" height="20" viewBox="0 0 60 20" aria-hidden="true" className="text-primary">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
```

Header uses `PageHeader` from `@/components/page-header` with the existing "+ Tenant/+ Escola" dialogs (import the existing dialog triggers from `platform-dashboard.tsx` if reusable; otherwise leave the create buttons as a follow-up — the create flow already exists on the old dashboard and is not regressed because sub-project 2 formalizes ops).

**Important:** filter inputs must reset page to 1 on change (mirror `students-page-client.tsx:91` effect). All labels hardcoded Portuguese.

- [ ] **Step 3: Replace the server page**

```tsx
// src/app/platform-admin/page.tsx
import { HydrationBoundary } from "@tanstack/react-query";
import { getAdminSsrHelpers } from "@/server/admin-ssr";
import { dehydrateSsr } from "@/server/ssr";
import { PortfolioOverview } from "./_components/portfolio-overview";

export const dynamic = "force-dynamic";

export default async function PlatformAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string; risk?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  // Mirror the client's input derivation exactly so prefetch keys match.
  const page = Number(sp.page) >= 1 ? Number(sp.page) : 1;
  const overviewInput = {
    page,
    pageSize: 10,
    ...(sp.q ? { search: sp.q } : {}),
    status: (sp.status as "ALL" | "ACTIVE" | "INACTIVE") ?? "ALL",
    risk: (sp.risk as "ALL" | "HEALTHY" | "AT_RISK" | "NEW" | "INACTIVE") ?? "ALL",
    sort: (sp.sort as "name" | "createdAt" | "students" | "classes30d") ?? "name",
  };

  const helpers = await getAdminSsrHelpers();
  await Promise.all([
    helpers.admin.portfolio.kpis.prefetch(),
    helpers.admin.portfolio.trends.prefetch({ rangeDays: 90 }),
    helpers.admin.portfolio.overview.prefetch(overviewInput),
  ]);

  return (
    <HydrationBoundary state={dehydrateSsr(helpers)}>
      <PortfolioOverview />
    </HydrationBoundary>
  );
}
```

The old `PlatformDashboard` component + its data loads are removed from this page; keep `_components/platform-dashboard.tsx` file for now only if its create-dialogs are reused, otherwise it's dead and can be deleted in the ops sub-project. Note in the commit which you did.

- [ ] **Step 4: Verify (build + gates + manual)**

Run: `pnpm type-check && pnpm lint && pnpm build`
Then run `pnpm dev`, log in as an operator, visit `admin.localhost:3000` (or the dev admin host), and confirm: KPI tiles populate, both charts render, the table lists schools with health badges + sparklines, search/status/risk/sort/pagination all update the URL and the list, and clicking a row navigates to `/platform-admin/tenants/<id>` (404s until Task 11 — expected). Use the `/verify` skill or drive it in a browser.

- [ ] **Step 5: Checkpoint**

Commit message: `feat(admin): portfolio overview page (KPIs, trends, health table)`

---

# PHASE 2 — Per-account page

### Task 9: `admin.account.get` (header, snapshot, members, config, consents)

**Files:**
- Modify: `src/server/routers/admin/index.ts` (add `account` sub-router), create `src/server/routers/admin/account.ts`
- Test: `tests/admin-account.test.ts`

**Interfaces:**
- Produces: `admin.account.get({ tenantId })` →
  `{ tenant: {id,name,status,createdAt}, schools: {id,name,subdomain,createdAt,config}[], snapshot: {activeStudents,instructors,wau,classes30d,passRate}, members: {byRole: Record<UserRole,{active:number,inactive:number}>, staff: {name,email,phone,role,schoolName}[]}, consents: {type,count}[], lastActiveAt: Date | null }`
- Staff = ADMIN/SECRETARY/INSTRUCTOR only (never STUDENT). Students appear as counts.

- [ ] **Step 1: Write the failing test**

```ts
// tests/admin-account.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/server/db";
import { createCallerFactory, type TRPCContext } from "@/server/trpc";
import { appRouter } from "@/server/routers/_app";
import { createTestTenant, cleanupTenants, type TestTenant } from "./helpers/tenant";

const createCaller = createCallerFactory(appRouter);
function adminCaller() {
  const ctx: TRPCContext = { db, tenantId: null, ip: null, user: { id: "op" }, userEmail: "op@convlyx.com", loadMembership: async () => null };
  return createCaller(ctx);
}

describe("admin.account.get", () => {
  let a: TestTenant;
  const original = process.env.PLATFORM_ADMIN_EMAILS;
  beforeAll(async () => { process.env.PLATFORM_ADMIN_EMAILS = "op@convlyx.com"; a = await createTestTenant("ACC"); });
  afterAll(async () => { process.env.PLATFORM_ADMIN_EMAILS = original; await cleanupTenants(a.tenantId); });

  it("returns tenant, schools, snapshot and staff (no students in staff list)", async () => {
    const res = await adminCaller().admin.account.get({ tenantId: a.tenantId });
    expect(res.tenant.id).toBe(a.tenantId);
    expect(res.schools.length).toBe(1);
    expect(res.snapshot.activeStudents).toBe(1);
    expect(res.snapshot.instructors).toBe(1);
    expect(res.members.staff.every((m) => m.role !== "STUDENT")).toBe(true);
  });
  it("throws NOT_FOUND for an unknown tenant", async () => {
    await expect(adminCaller().admin.account.get({ tenantId: "00000000-0000-0000-0000-000000000000" })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm vitest run tests/admin-account.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `account.get`**

```ts
// src/server/routers/admin/account.ts
import { TRPCError } from "@trpc/server";
import { router, adminProcedure } from "../../trpc";
import { adminAccountSchema } from "@/lib/validations/admin";
import { subDaysUTC } from "../../lib/time-buckets";

const DAY_MS = 86_400_000;

export const accountRouter = router({
  get: adminProcedure.input(adminAccountSchema).query(async ({ ctx, input }) => {
    const tenant = await ctx.db.tenant.findUnique({
      where: { id: input.tenantId },
      select: { id: true, name: true, status: true, createdAt: true },
    });
    if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "errors.notFound" });

    const now = new Date();
    const since30 = subDaysUTC(now, 30);
    const wauSince = subDaysUTC(now, 7);

    const [schools, byRoleRows, staff, examAgg, consents, lastSeen, lastCheckin, classes30d, wau] =
      await Promise.all([
        ctx.db.school.findMany({
          where: { tenantId: tenant.id },
          orderBy: { name: "asc" },
          select: {
            id: true, name: true, subdomain: true, createdAt: true,
            timeZone: true, cancellationNoticeHours: true, practicalSelfEnrollEnabled: true,
          },
        }),
        ctx.db.membership.groupBy({ by: ["role", "status"], where: { tenantId: tenant.id }, _count: { _all: true } }),
        ctx.db.membership.findMany({
          where: { tenantId: tenant.id, role: { in: ["ADMIN", "SECRETARY", "INSTRUCTOR"] } },
          select: { role: true, name: true, phone: true, user: { select: { email: true } }, school: { select: { name: true } } },
          orderBy: [{ role: "asc" }, { name: "asc" }],
        }),
        ctx.db.exam.groupBy({ by: ["result"], where: { tenantId: tenant.id, result: { in: ["PASSED", "FAILED", "NO_SHOW"] } }, _count: { _all: true } }),
        ctx.db.consentRecord.groupBy({ by: ["type"], where: { tenantId: tenant.id }, _count: { _all: true } }),
        ctx.db.membership.aggregate({ where: { tenantId: tenant.id }, _max: { lastSeenAt: true } }),
        ctx.db.enrollment.aggregate({ where: { tenantId: tenant.id, checkedInAt: { not: null } }, _max: { checkedInAt: true } }),
        ctx.db.classSession.count({ where: { tenantId: tenant.id, createdAt: { gte: since30 } } }),
        ctx.db.membership.count({ where: { tenantId: tenant.id, lastSeenAt: { gte: wauSince } } }),
      ]);

    const byRole: Record<string, { active: number; inactive: number }> = {};
    for (const r of byRoleRows) {
      byRole[r.role] ??= { active: 0, inactive: 0 };
      byRole[r.role][r.status === "ACTIVE" ? "active" : "inactive"] += r._count._all;
    }
    const passed = examAgg.find((e) => e.result === "PASSED")?._count._all ?? 0;
    const examTotal = examAgg.reduce((s, e) => s + e._count._all, 0);

    const lastActiveAt = [lastSeen._max.lastSeenAt, lastCheckin._max.checkedInAt]
      .filter((d): d is Date => d != null)
      .sort((x, y) => y.getTime() - x.getTime())[0] ?? null;

    return {
      tenant,
      schools: schools.map((s) => ({
        id: s.id, name: s.name, subdomain: s.subdomain, createdAt: s.createdAt,
        config: { timeZone: s.timeZone, cancellationNoticeHours: s.cancellationNoticeHours, practicalSelfEnrollEnabled: s.practicalSelfEnrollEnabled },
      })),
      snapshot: {
        activeStudents: byRole["STUDENT"]?.active ?? 0,
        instructors: byRole["INSTRUCTOR"]?.active ?? 0,
        wau,
        classes30d,
        passRate: examTotal > 0 ? passed / examTotal : null,
      },
      members: {
        byRole,
        staff: staff.map((m) => ({ name: m.name, email: m.user.email, phone: m.phone, role: m.role, schoolName: m.school.name })),
      },
      consents: consents.map((c) => ({ type: c.type, count: c._count._all })),
      lastActiveAt,
    };
  }),
});
```

Mount in `src/server/routers/admin/index.ts`: `account: accountRouter`.

- [ ] **Step 4: Run tests + gates**

Run: `pnpm vitest run tests/admin-account.test.ts && pnpm type-check && pnpm lint`
Expected: green.

- [ ] **Step 5: Checkpoint**

Commit message: `feat(admin): account.get (snapshot, members, config, consents)`

---

### Task 10: `admin.account.charts` + `admin.account.timeline`

**Files:**
- Modify: `src/server/routers/admin/account.ts`, `src/lib/validations/admin.ts` (add `adminTimelineSchema`)
- Test: extend `tests/admin-account.test.ts`

**Interfaces:**
- Produces:
  - `admin.account.charts({ tenantId, schoolId?, rangeDays })` → `{ granularity, enrolments: {bucket,count}[], classesByType: {bucket, theory, practical}[], funnel: {status,count}[], passByCategory: {category, attempts, passed, passRate}[], courseCompletion: {status,count}[] }`
  - `admin.account.timeline({ tenantId, cursor? })` → `{ items: {kind, at, label}[], nextCursor: string | null }` — aggregate/attributed events only (class created/updated by staff name, exam scheduled, check-in counts). No student names.

- [ ] **Step 1: Add timeline schema**

```ts
// append to src/lib/validations/admin.ts
export const adminTimelineSchema = z.object({
  tenantId: z.string().uuid(),
  cursor: z.string().datetime().optional(),
});
```

- [ ] **Step 2: Write failing tests**

```ts
it("charts returns aligned aggregate series", async () => {
  const c = await adminCaller().admin.account.charts({ tenantId: a.tenantId, rangeDays: 90 });
  expect(["day","week","month"]).toContain(c.granularity);
  expect(Array.isArray(c.enrolments)).toBe(true);
  expect(Array.isArray(c.funnel)).toBe(true);
});
it("timeline returns attributed events without student names", async () => {
  const t = await adminCaller().admin.account.timeline({ tenantId: a.tenantId });
  expect(Array.isArray(t.items)).toBe(true);
  // the seed class was created by "Admin ACC" — attribution is staff, not student
});
```

- [ ] **Step 3: Run to verify fail**

Run: `pnpm vitest run tests/admin-account.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement `charts`**

Mirror the analytics router's read+bucket approach (import bucket helpers from `time-buckets.ts`). Series:
- `enrolments`: bucket `Enrollment.enrolledAt` (filtered by tenantId + optional schoolId + `enrolledAt >= since`).
- `classesByType`: bucket `ClassSession.createdAt`, split by `classType` (THEORY/PRACTICAL).
- `funnel`: `groupBy status` on `Enrollment` within range → array in fixed order `["ENROLLED","ATTENDED","NO_SHOW","CANCELLED"]`.
- `passByCategory`: copy `analytics.passRateByCategory` logic but with explicit `tenantId` filter (raw db).
- `courseCompletion`: `groupBy status` on `StudentCourse` (IN_PROGRESS/COMPLETED/ABANDONED).

```ts
  charts: adminProcedure.input(adminAccountChartsSchema).query(async ({ ctx, input }) => {
    const granularity = granularityFor(input.rangeDays);
    const keys = bucketKeysForRange(input.rangeDays, granularity);
    const since = new Date(`${keys[0]}T00:00:00.000Z`);
    const scope = { tenantId: input.tenantId, ...(input.schoolId && { schoolId: input.schoolId }) };

    const [enr, sessions, funnelRows, exams, courseRows] = await Promise.all([
      ctx.db.enrollment.findMany({ where: { ...scope, enrolledAt: { gte: since } }, select: { enrolledAt: true } }),
      ctx.db.classSession.findMany({ where: { ...scope, createdAt: { gte: since } }, select: { createdAt: true, classType: true } }),
      ctx.db.enrollment.groupBy({ by: ["status"], where: { ...scope, enrolledAt: { gte: since } }, _count: { _all: true } }),
      ctx.db.exam.findMany({ where: { ...scope, result: { in: ["PASSED","FAILED","NO_SHOW"] }, scheduledAt: { gte: since } }, select: { result: true, course: { select: { category: true } } } }),
      ctx.db.studentCourse.groupBy({ by: ["status"], where: { ...scope }, _count: { _all: true } }),
    ]);

    const enrol = new Map(keys.map((k) => [k, 0]));
    for (const e of enr) { const k = bucketKey(e.enrolledAt, granularity); if (enrol.has(k)) enrol.set(k, enrol.get(k)! + 1); }

    const byType = new Map(keys.map((k) => [k, { theory: 0, practical: 0 }]));
    for (const s of sessions) { const k = bucketKey(s.createdAt, granularity); const b = byType.get(k); if (b) { if (s.classType === "THEORY") b.theory++; else b.practical++; } }

    const funnelOrder = ["ENROLLED","ATTENDED","NO_SHOW","CANCELLED"] as const;
    const funnelMap = new Map(funnelRows.map((r) => [r.status, r._count._all]));

    const cat = new Map<string, { attempts: number; passed: number }>();
    for (const e of exams) { const c = e.course.category; const b = cat.get(c) ?? { attempts: 0, passed: 0 }; b.attempts++; if (e.result === "PASSED") b.passed++; cat.set(c, b); }

    return {
      granularity,
      enrolments: Array.from(enrol, ([bucket, count]) => ({ bucket, count })),
      classesByType: Array.from(byType, ([bucket, v]) => ({ bucket, ...v })),
      funnel: funnelOrder.map((status) => ({ status, count: funnelMap.get(status) ?? 0 })),
      passByCategory: Array.from(cat, ([category, b]) => ({ category, attempts: b.attempts, passed: b.passed, passRate: b.attempts ? b.passed / b.attempts : 0 })).sort((x, y) => y.attempts - x.attempts),
      courseCompletion: courseRows.map((r) => ({ status: r.status, count: r._count._all })),
    };
  }),
```

Add imports `bucketKey, bucketKeysForRange, granularityFor` and `adminAccountChartsSchema`.

- [ ] **Step 5: Implement `timeline`**

Aggregate, staff-attributed events. Pull the most recent N (e.g. 30) `ClassSession` (createdAt + createdBy name via `createdBy` relation) and `Exam` (scheduledAt) for the tenant, plus a daily count of check-ins; merge, sort desc, cursor on the ISO timestamp.

```ts
  timeline: adminProcedure.input(adminTimelineSchema).query(async ({ ctx, input }) => {
    const before = input.cursor ? new Date(input.cursor) : new Date();
    const PAGE = 30;
    const [classes, exams] = await Promise.all([
      ctx.db.classSession.findMany({
        where: { tenantId: input.tenantId, createdAt: { lt: before } },
        orderBy: { createdAt: "desc" }, take: PAGE,
        select: { createdAt: true, title: true, createdBy: { select: { name: true } } },
      }),
      ctx.db.exam.findMany({
        where: { tenantId: input.tenantId, createdAt: { lt: before } },
        orderBy: { createdAt: "desc" }, take: PAGE,
        select: { createdAt: true, type: true },
      }),
    ]);
    const items = [
      ...classes.map((c) => ({ kind: "class_created" as const, at: c.createdAt, label: `Aula "${c.title}" criada${c.createdBy?.name ? ` por ${c.createdBy.name}` : ""}` })),
      ...exams.map((e) => ({ kind: "exam_scheduled" as const, at: e.createdAt, label: `Exame ${e.type === "THEORY" ? "teórico" : "prático"} agendado` })),
    ].sort((x, y) => y.at.getTime() - x.at.getTime()).slice(0, PAGE);
    const nextCursor = items.length === PAGE ? items[items.length - 1].at.toISOString() : null;
    return { items, nextCursor };
  }),
```

Note: `createdBy` is a staff User (ClassSession.createdById), so the name is staff attribution — compliant with aggregates+staff-only. Exams carry no student name here.

- [ ] **Step 6: Run tests + gates**

Run: `pnpm vitest run tests/admin-account.test.ts && pnpm type-check && pnpm lint`
Expected: green.

- [ ] **Step 7: Checkpoint**

Commit message: `feat(admin): account charts + activity timeline queries`

---

### Task 11: Per-account page UI

**Files:**
- Create: `src/app/platform-admin/tenants/[tenantId]/page.tsx`, `src/app/platform-admin/tenants/[tenantId]/_components/account-detail.tsx`

**Interfaces:**
- Consumes: `admin.account.{get,charts,timeline}`, `getAdminSsrHelpers`, `dehydrateSsr`, `HealthBadge`.

- [ ] **Step 1: Server page (SSR prefetch)**

```tsx
// src/app/platform-admin/tenants/[tenantId]/page.tsx
import { HydrationBoundary } from "@tanstack/react-query";
import { getAdminSsrHelpers } from "@/server/admin-ssr";
import { dehydrateSsr } from "@/server/ssr";
import { AccountDetail } from "./_components/account-detail";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  params, searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ school?: string; range?: string }>;
}) {
  const { tenantId } = await params;
  const sp = await searchParams;
  const schoolId = sp.school && sp.school !== "ALL" ? sp.school : undefined;
  const rangeRaw = Number(sp.range);
  const rangeDays = ([30, 90, 365] as number[]).includes(rangeRaw) ? (rangeRaw as 30 | 90 | 365) : 90;

  const helpers = await getAdminSsrHelpers();
  await Promise.all([
    helpers.admin.account.get.prefetch({ tenantId }),
    helpers.admin.account.charts.prefetch({ tenantId, ...(schoolId && { schoolId }), rangeDays }),
    helpers.admin.account.timeline.prefetch({ tenantId }),
  ]);

  return (
    <HydrationBoundary state={dehydrateSsr(helpers)}>
      <AccountDetail tenantId={tenantId} />
    </HydrationBoundary>
  );
}
```

- [ ] **Step 2: Client component**

`account-detail.tsx` (`"use client"`, takes `{ tenantId }`):
- reads `useUrlParam("school","ALL")`, `useUrlParam("range","90")`; derives the same inputs as the server (school → undefined when "ALL"; range → number).
- header: back-link to `/platform-admin`, tenant name, `<HealthBadge>` (compute health client-side is not available — instead show `tenant.status` + `lastActiveAt`; the badge on this page reflects status/age only, or omit and rely on the overview's badge — keep it simple: show status pill + "Ativa desde …" + "Última atividade …").
- snapshot: `StatCard` grid (activeStudents, instructors, wau, classes30d, passRate formatted as %).
- filters: a school `radix-select` (options from `account.get` schools + "Todas") and a range select (30/90/365) — both write URL params.
- charts grid: `ChartCard`-wrapped Recharts for `enrolments` (bar), `classesByType` (stacked bar theory/practical), `funnel` (horizontal bar over the 4 statuses), `passByCategory` (bar), `courseCompletion` (donut via Recharts `PieChart`). Each `aria-hidden` + paired `SrDataTable`. Follow the exact conventions in `analytics/_components/*`.
- members panel: role counts (active/inactive) + a staff table (name/email/phone/role/school). A disabled "Ver alunos" button with a tooltip "Disponível no módulo de suporte" (placeholder for sub-project 3 — do NOT wire student PII here).
- timeline panel: list from `account.timeline`, "carregar mais" using `nextCursor` (`fetchNextPage` pattern via `useInfiniteQuery` or manual cursor state — a manual `useState<string|undefined>` cursor with a "load more" refetch is fine).
- config + consents panels: read from `account.get`.

All Portuguese, `rounded-xl` surfaces, theme tokens only.

- [ ] **Step 3: Verify (build + gates + manual)**

Run: `pnpm type-check && pnpm lint && pnpm build`
Then `pnpm dev`, click a school from the overview → confirm the account page renders header, snapshot, all 5 charts, members with staff contacts (and NO student names), timeline with "load more", config + consents; the school + range selects update charts via URL; an unknown tenantId shows a graceful error (tRPC error → the client query error state). Drive via `/verify`.

- [ ] **Step 4: Checkpoint**

Commit message: `feat(admin): per-account detail page (snapshot, charts, timeline)`

---

## Self-Review

**Spec coverage:**
- §4.1 helper → Task 1. §4.3 heartbeat → Task 2. §4.2 adminProcedure/router → Tasks 3,5. §8.2 health → Task 4. §5.1 overview (KPIs/trends/list + page) → Tasks 6,7,8. §5.2 account (get/charts/timeline + page) → Tasks 9,10,11. §8.3 perf (SSR prefetch, grouped queries, dub1, throttle) → Tasks 2,8,11 + inherited handler pinning. §8.4 testing → tests in every logic task. §2 non-i18n / aggregates-only / raw db → Global Constraints + enforced in each query (staff-only selects, counts for students).
- Sub-projects 2 (ops) & 3 (support/impersonation) are intentionally **out of this plan** — separate specs/plans, as agreed. The "Ver alunos" button is left disabled as the seam.

**Placeholder scan:** No TBD/TODO. The router `ping` is a real, tested endpoint (auth seam), not a placeholder. UI tasks name exact components, props, queries, and reference files; the one deliberate deferral (student PII / create-dialogs) is called out with rationale, not left vague.

**Type consistency:** `SchoolHealth`, `classifySchoolHealth` input shape, `HEALTH_THRESHOLDS`, `shouldHeartbeat`/`recordHeartbeat` signatures, `adminProcedure` ctx (`actorEmail`, `audit`), context additions (`userEmail`, `lastSeenAt`) are used identically across tasks. `overview` row shape and `account.get`/`charts`/`timeline` return shapes match what Tasks 8 and 11 consume. Time-bucket helpers are extracted once (Task 6 step 5) and imported by both analytics and admin routers.

**One flagged tradeoff (not a gap):** `overview`'s `risk` filter + `students`/`classes30d` sort apply on the enriched current page, so a risk-filtered `total` reflects pre-filter school count. Documented inline in Task 7; acceptable for an internal tool and cheaply upgradable later by materializing health.

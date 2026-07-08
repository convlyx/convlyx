# Notification Delivery Reliability — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the in-app `Notification` row atomic with the business write (never silently lost), and make push a guaranteed, retried background side effect — with no outbox table and no cron.

**Architecture:** Split `notifications.ts` into `recordNotification(s)` (insert the row via a passed `tx`/`db`, return a `PushJob`) + `dispatchPush` (fire push after the response via Next's `after()`, with in-process retry). Callers wrap the business mutation + the notification insert in one interactive `$transaction`, then `dispatchPush` after commit. Push retry lives per-subscription in `push.ts`.

**Tech Stack:** Next.js 16 (`after` from `next/server`), tRPC v11, Prisma 7 (interactive `$transaction`), `web-push`, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-01-notification-delivery-reliability-design.md`.

## Global Constraints

- **NO git commits** (owner's standing rule) — implementers create/verify only; report the message. Ignore each task's "Commit" step's git command.
- **Package manager is pnpm**, never npm.
- **PT-PT only** for any user-facing strings (none new expected here).
- **No schema change, no new table, no cron.**
- **Tenant scoping:** notification inserts go through the transaction client `tx` (the tenant-scope extension applies to `tx`, as `user.anonymize` already relies on); `findFirst`, never `findUnique`, on scoped models.
- **Behavior change (intended):** a notification-row insert failing now rolls back the business op (loud) instead of being swallowed (silent).
- **Preserve existing push semantics:** push text falls back to `resolveTranslation(key, params)` when `pushTitle`/`pushBody` are absent; `url` is `"/"`; 404/410 prune the subscription.
- **Green build every task:** Task 1 ADDS the new helpers alongside the old `createNotification(s)`; callers migrate in Tasks 2–6; the old helpers are removed only in Task 7 once unused.

---

## Conversion pattern (referenced by Tasks 2–6)

Every migrated call site follows this shape. Collect push jobs inside the transaction, dispatch after commit:

```ts
import { recordNotification, recordNotifications, dispatchPush, type PushJob } from "@/server/lib/notifications";

const jobs: (PushJob | null)[] = [];
await ctx.db.$transaction(async (tx) => {
  await tx.<businessMutation>(...);                    // the existing mutation(s)
  jobs.push(await recordNotification(tx, {            // was: createNotification({ db: ctx.db, ... })
    tenantId: ctx.tenantId,
    userId: <recipientId>,
    type: "<same type>",
    titleKey: "<same key>",
    messageKey: "<same key>",
    params: { ... },          // same params
    // pushTitle/pushBody only if the original passed them
  }));
});
dispatchPush(ctx.db, jobs);                            // best-effort, guaranteed background
```

Notes:
- `recordNotification` takes the client as its **first positional arg** (`tx`), then the params object (no `db` key inside params anymore).
- Multiple recipients in one call → `recordNotifications(tx, { userIds, ... })`.
- A site that notifies several distinct groups pushes multiple jobs into the same `jobs` array inside the one transaction.
- Array-form transactions (`ctx.db.$transaction([ ... ])`) convert to the interactive form above.
- The business mutation keeps its existing `where`/`data`; only its client changes from `ctx.db` to `tx`.

---

## Task 1: Split helpers + resilient push (foundation)

**Files:**
- Modify: `src/server/lib/notifications.ts` (add new exports; keep old ones for now)
- Modify: `src/server/lib/push.ts` (add per-subscription retry)
- Test: `tests/notifications.test.ts` (new), `tests/push-retry.test.ts` (new)

**Interfaces:**
- Produces: `type PushJob = { tenantId: string; userIds: string[]; title: string; body: string; url?: string }`.
- Produces: `recordNotification(client: DbClient, p: { tenantId; userId; type; titleKey; messageKey; params?; pushTitle?; pushBody? }): Promise<PushJob | null>` — inserts one row via `client`, returns the push job (or `null` if the user doesn't exist).
- Produces: `recordNotifications(client: DbClient, p: { tenantId; userIds: string[]; type; titleKey; messageKey; params?; pushTitle?; pushBody? }): Promise<PushJob | null>`.
- Produces: `dispatchPush(db: DbClient, jobs: (PushJob | null)[]): void` — schedules push via `after()`, never throws.

- [ ] **Step 1: Add per-subscription retry to `sendPushToUser` in `src/server/lib/push.ts`**

Replace the `for (const sub of subscriptions) { ... }` loop body with a retry loop (transient failures retried; 404/410 prune and stop):

```ts
const MAX_PUSH_ATTEMPTS = 3;

for (const sub of subscriptions) {
  for (let attempt = 1; attempt <= MAX_PUSH_ATTEMPTS; attempt++) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
      break; // delivered
    } catch (error: unknown) {
      const statusCode = (error as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await db.pushSubscription.delete({ where: { id: sub.id } })
          .catch((e) => logger.warn("push subscription cleanup failed", { error: e, subscriptionId: sub.id }));
        break; // dead subscription — do not retry
      }
      if (attempt === MAX_PUSH_ATTEMPTS) {
        logger.warn("push send failed after retries", { error, subscriptionId: sub.id, attempts: attempt });
        break;
      }
      await new Promise((r) => setTimeout(r, attempt * 500)); // backoff: 500ms, 1000ms
    }
  }
}
```

Leave `sendPushToUsers` (the `Promise.allSettled` wrapper) unchanged.

- [ ] **Step 2: Add the new helpers to `src/server/lib/notifications.ts`**

Keep `resolveTranslation`, `formatClassTime`, and the existing `createNotification`/`createNotifications` exactly as-is (removed in Task 7). Add the import and the new exports:

```ts
import { after } from "next/server";
// (existing imports stay; `sendPushToUsers` is already imported)

export type PushJob = {
  tenantId: string;
  userIds: string[];
  title: string;
  body: string;
  url?: string;
};

type RecordParams = {
  tenantId: string;
  userId: string;
  type: string;
  titleKey: string;
  messageKey: string;
  params?: Record<string, string>;
  pushTitle?: string;
  pushBody?: string;
};

/** Insert ONE notification row via `client` (a tx or db). Returns a PushJob to
 *  dispatch after commit, or null if the user was not found. Sends no push. */
export async function recordNotification(
  client: DbClient,
  p: RecordParams,
): Promise<PushJob | null> {
  const user = await client.user.findFirst({
    where: { id: p.userId },
    select: { schoolId: true },
  });
  if (!user) return null;

  await client.notification.create({
    data: {
      tenantId: p.tenantId,
      schoolId: user.schoolId,
      userId: p.userId,
      type: p.type,
      title: p.titleKey,
      message: p.messageKey,
      ...(p.params && { data: p.params as object }),
    },
  });

  return {
    tenantId: p.tenantId,
    userIds: [p.userId],
    title: p.pushTitle ?? resolveTranslation(p.titleKey, p.params),
    body: p.pushBody ?? resolveTranslation(p.messageKey, p.params),
    url: "/",
  };
}

/** Insert notification rows for many users via `client`. Returns a PushJob or null. */
export async function recordNotifications(
  client: DbClient,
  p: Omit<RecordParams, "userId"> & { userIds: string[] },
): Promise<PushJob | null> {
  if (p.userIds.length === 0) return null;
  const users = await client.user.findMany({
    where: { id: { in: p.userIds } },
    select: { id: true, schoolId: true },
  });
  const schoolByUserId = new Map(users.map((u) => [u.id, u.schoolId]));
  const recipients = p.userIds.filter((id) => schoolByUserId.has(id));
  if (recipients.length === 0) return null;

  await client.notification.createMany({
    data: recipients.map((userId) => ({
      tenantId: p.tenantId,
      schoolId: schoolByUserId.get(userId)!,
      userId,
      type: p.type,
      title: p.titleKey,
      message: p.messageKey,
      ...(p.params && { data: p.params as object }),
    })),
  });

  return {
    tenantId: p.tenantId,
    userIds: recipients,
    title: p.pushTitle ?? resolveTranslation(p.titleKey, p.params),
    body: p.pushBody ?? resolveTranslation(p.messageKey, p.params),
    url: "/",
  };
}

/** Fire push for the given jobs as guaranteed background work (runs after the
 *  HTTP response, within the same invocation). Best-effort — never throws. */
export function dispatchPush(db: DbClient, jobs: (PushJob | null)[]): void {
  const real = jobs.filter((j): j is PushJob => j !== null);
  if (real.length === 0) return;
  after(async () => {
    for (const job of real) {
      try {
        await sendPushToUsers(db, job.tenantId, job.userIds, {
          title: job.title,
          body: job.body,
          url: job.url,
        });
      } catch (e) {
        logger.warn("push dispatch failed", { error: e });
      }
    }
  });
}
```

- [ ] **Step 3: Write the failing tests**

Create `tests/notifications.test.ts` (integration — uses the two-tenant helper):

```ts
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/server/db";
import { recordNotification, recordNotifications } from "@/server/lib/notifications";
import { createTestTenant, cleanupTenants, type TestTenant } from "./helpers/tenant";

let A: TestTenant;
afterAll(async () => { if (A) await cleanupTenants(A.tenantId); });

describe("recordNotification", () => {
  it("writes a row and returns a PushJob (push text falls back to i18n keys)", async () => {
    A = await createTestTenant("notif");
    const job = await recordNotification(db, {
      tenantId: A.tenantId,
      userId: A.studentUserId,
      type: "class.assigned",
      titleKey: "notifications.newClassAssigned",
      messageKey: "notifications.newClassAssigned",
    });
    expect(job).not.toBeNull();
    expect(job!.userIds).toEqual([A.studentUserId]);
    expect(typeof job!.title).toBe("string");
    const rows = await db.notification.findMany({ where: { tenantId: A.tenantId, userId: A.studentUserId } });
    expect(rows.length).toBe(1);
    expect(rows[0].type).toBe("class.assigned");
  });

  it("returns null for an unknown user", async () => {
    const job = await recordNotification(db, {
      tenantId: A.tenantId,
      userId: "00000000-0000-0000-0000-000000000000",
      type: "x", titleKey: "x", messageKey: "x",
    });
    expect(job).toBeNull();
  });

  it("recordNotifications skips unknown users and returns recipients", async () => {
    const job = await recordNotifications(db, {
      tenantId: A.tenantId,
      userIds: [A.instructorUserId, "00000000-0000-0000-0000-000000000000"],
      type: "class.created", titleKey: "notifications.newClass", messageKey: "notifications.newClass",
    });
    expect(job!.userIds).toEqual([A.instructorUserId]);
  });
});
```

Create `tests/push-retry.test.ts` (unit — mock `web-push`, stub the db):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendNotification = vi.fn();
vi.mock("web-push", () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: (...a: unknown[]) => sendNotification(...a) },
}));

// VAPID keys must be set for push.ts to attempt sending.
process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||= "test-public";
process.env.VAPID_PRIVATE_KEY ||= "test-private";

const fakeDb = {
  pushSubscription: {
    findMany: async () => [{ id: "s1", endpoint: "e", p256dh: "p", auth: "a" }],
    delete: async () => ({}),
  },
} as unknown as import("@/server/lib/tenant-scope").DbClient;

beforeEach(() => sendNotification.mockReset());

describe("sendPushToUser retry", () => {
  it("retries a transient failure then succeeds", async () => {
    const { sendPushToUser } = await import("@/server/lib/push");
    sendNotification
      .mockRejectedValueOnce({ statusCode: 500 })
      .mockResolvedValueOnce(undefined);
    await sendPushToUser(fakeDb, "t1", "u1", { title: "x", body: "y" });
    expect(sendNotification).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 410 (prunes instead)", async () => {
    const { sendPushToUser } = await import("@/server/lib/push");
    sendNotification.mockRejectedValueOnce({ statusCode: 410 });
    await sendPushToUser(fakeDb, "t1", "u1", { title: "x", body: "y" });
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 4: Run tests to confirm they fail, then pass after Steps 1–2**

Run: `pnpm vitest run tests/notifications.test.ts tests/push-retry.test.ts`
Expected: PASS (3 + 2). If `after()` import causes an issue in the unit context, note it — `recordNotification`/`recordNotifications` don't call `after()`, so these tests shouldn't touch it; only `dispatchPush` does (exercised in Task 7 / runtime).

- [ ] **Step 5: Verify build**

Run: `pnpm type-check && pnpm lint`
Expected: both clean (old `createNotification(s)` still present and used → no breakage).

- [ ] **Step 6: Commit** — `feat(notifications): add transactional record helpers + resilient push` (do not run git commit).

---

## Task 2: Migrate the `class` router

**Files:** Modify `src/server/routers/class.ts`.
**Interfaces:** Consumes `recordNotification`/`recordNotifications`/`dispatchPush`/`PushJob` (Task 1).

Apply the **Conversion pattern** to all five notification sites (read each in the file; they currently call `createNotification`/`createNotifications` with `db: ctx.db`):

1. `create()` — instructor notification (`type: "class.created"`).
2. `create()` — auto-enrolled students (`createNotifications`, student-assigned).
3. `update()` — old instructor on reassignment.
4. `update()` — students + instructor on schedule change (two jobs, one transaction).
5. `cancel()` — enrolled students; **convert the existing `ctx.db.$transaction([...])` array form to the interactive form** and move the student-notification insert inside it.

**Per-site guidance:**
- For `create()`: wrap the existing `classSession.create` + the auto-enroll `enrollment.createMany` + the notification inserts in **one** interactive transaction. **If `create()` generates multiple sessions (recurrence loop), keep each session's own writes + its notification insert together at the existing granularity — do NOT build one mega-transaction spanning all recurrences.** Collect all jobs into one `jobs` array and `dispatchPush` once at the end.
- Keep every `type`, `titleKey`, `messageKey`, and `params` value identical to the current calls.

- [ ] **Step 1:** Apply the pattern to sites 1–5 (read the current code, transform per the pattern).
- [ ] **Step 2:** `pnpm type-check && pnpm lint` → clean.
- [ ] **Step 3:** `pnpm vitest run` → all existing tests still pass (the e2e/enrol/cancel flows exercise these paths).
- [ ] **Step 4:** Commit — `refactor(class): transactional notifications` (no git commit).

---

## Task 3: Migrate the `enrollment` router

**Files:** Modify `src/server/routers/enrollment.ts`.
**Interfaces:** Consumes Task 1 helpers.

Apply the **Conversion pattern** to both sites:
1. `enroll()` — notify the enrolled student when staff enrols them (`enrollment.create` + notification in one tx).
2. `cancel()` — notify the student when their enrolment is cancelled (`enrollment.delete` + notification in one tx).

Preserve the existing "only notify if `studentId !== ctx.user.id`" guards (put the `recordNotification` behind the same condition, still inside the transaction).

- [ ] **Step 1:** Apply the pattern to both sites.
- [ ] **Step 2:** `pnpm type-check && pnpm lint` → clean.
- [ ] **Step 3:** `pnpm vitest run` → pass.
- [ ] **Step 4:** Commit — `refactor(enrollment): transactional notifications` (no git commit).

---

## Task 4: Migrate the `exam` router

**Files:** Modify `src/server/routers/exam.ts`.
**Interfaces:** Consumes Task 1 helpers.

Apply the **Conversion pattern** to all five sites:
1. `schedule()` — notify student (exam scheduled).
2. `schedule()` — notify accompanying instructor.
3. `recordResult()` — notify student of result.
4. `cancel()` — notify student.
5. `cancel()` — notify instructor.

For each: wrap the existing `exam.create`/`exam.update` + its notification insert(s) in one interactive transaction; where a site fires two notifications (student + instructor), push both jobs into one array inside the same transaction. Preserve any "instructor optional" guards.

- [ ] **Step 1:** Apply the pattern to sites 1–5.
- [ ] **Step 2:** `pnpm type-check && pnpm lint` → clean.
- [ ] **Step 3:** `pnpm vitest run` → pass.
- [ ] **Step 4:** Commit — `refactor(exam): transactional notifications` (no git commit).

---

## Task 5: Migrate the `course` and `user` routers

**Files:** Modify `src/server/routers/course.ts`, `src/server/routers/user.ts`.
**Interfaces:** Consumes Task 1 helpers.

1. `course.abandon()` — notify the student. **Convert the existing `ctx.db.$transaction([...])` array form to the interactive form** and move the notification insert inside it. Preserve the `cancelledCount` value used in the message `params` (compute it from the `updateMany` result inside the transaction).
2. `user.deactivate()` — notify the deactivated user. Wrap the `user.updateMany` + notification insert in one interactive transaction.

- [ ] **Step 1:** Apply the pattern to both sites.
- [ ] **Step 2:** `pnpm type-check && pnpm lint` → clean.
- [ ] **Step 3:** `pnpm vitest run` → pass.
- [ ] **Step 4:** Commit — `refactor(course,user): transactional notifications` (no git commit).

---

## Task 6: Update the reminders cron

**Files:** Modify `src/app/api/cron/reminders/route.ts`.
**Interfaces:** Consumes Task 1 helpers.

The cron has **no business mutation** and processes tenants independently, so **no transaction**. For each class/exam reminder, replace the `createNotifications({ db, ... })` call with `recordNotifications(db, { ... })` (same `tenantId`/`userIds`/`type`/keys/`params`) collected into a `jobs` array, and call `dispatchPush(db, jobs)` after the loop (or per iteration). Keep the raw `db` (cross-tenant) and the existing bearer-auth/rate-limit/region.

- [ ] **Step 1:** Replace the two `createNotifications` calls (students + instructors) with `recordNotifications` + collect jobs; `dispatchPush(db, jobs)` after the loop.
- [ ] **Step 2:** `pnpm type-check && pnpm lint` → clean.
- [ ] **Step 3:** Commit — `refactor(cron): use record + dispatchPush for reminders` (no git commit).

---

## Task 7: Atomicity test + remove the old helpers

**Files:** Modify `tests/notifications.test.ts`; modify `src/server/lib/notifications.ts` (remove `createNotification`/`createNotifications`).
**Interfaces:** Consumes Task 1 helpers; confirms Tasks 2–6 removed all old-helper callers.

- [ ] **Step 1: Add an atomicity test** to `tests/notifications.test.ts` proving a rolled-back transaction leaves no orphaned notification row:

```ts
it("rolls back the notification row when the transaction throws", async () => {
  const uid = A.instructorUserId;
  const before = await db.notification.count({ where: { tenantId: A.tenantId, userId: uid } });
  await expect(
    db.$transaction(async (tx) => {
      await recordNotification(tx, {
        tenantId: A.tenantId, userId: uid,
        type: "class.created", titleKey: "notifications.newClass", messageKey: "notifications.newClass",
      });
      throw new Error("boom"); // force rollback after the insert
    }),
  ).rejects.toThrow("boom");
  const after = await db.notification.count({ where: { tenantId: A.tenantId, userId: uid } });
  expect(after).toBe(before); // no orphaned row
});
```

- [ ] **Step 2: Confirm no remaining callers of the old helpers**

Run: `grep -rn "createNotification" src/` (via the search tool)
Expected: **zero** references outside `notifications.ts` itself. If any remain, migrate them (they were missed in Tasks 2–6) before removing.

- [ ] **Step 3: Remove `createNotification` and `createNotifications`** from `src/server/lib/notifications.ts` (keep `resolveTranslation`, `formatClassTime`, and the new exports).

- [ ] **Step 4: Full verification**

Run: `pnpm type-check && pnpm lint && pnpm vitest run`
Expected: all green; no reference to the removed functions.

- [ ] **Step 5: Commit** — `refactor(notifications): remove legacy combined helpers` (no git commit).

---

## Self-Review

- **Spec coverage:** transactional in-app row → Tasks 2–6 (interactive tx + `recordNotification` inside); `dispatchPush` via `after()` with retry → Task 1 (helper) + Task 1 push.ts retry; cron → Task 6; loud-rollback behavior → exercised by Task 7 atomicity test; unit + integration + push-retry tests → Tasks 1 & 7. `after()`-vs-`waitUntil` open item → called out in Task 1 Step 4. Non-goals (no table/cron/columns) respected. Covered.
- **Placeholder scan:** the per-router tasks intentionally reference the shared **Conversion pattern** + name every site rather than reproducing ~15 near-identical before/after blocks — this is a mechanical refactor of code the implementer reads in place, not omitted content; every site is enumerated with its exact `type`/keys to preserve. No TBD/vague steps.
- **Type consistency:** `PushJob`, `recordNotification(client, p)`, `recordNotifications(client, p)`, `dispatchPush(db, jobs)` are used identically in Tasks 1–7.
- **Open item to verify during Task 1/first runtime check:** `after()` from `next/server` runs the push post-response from the tRPC route handler; if not, swap `dispatchPush`'s `after(cb)` for `waitUntil(cb)` from `@vercel/functions` (add the dep) — retry logic is unchanged.

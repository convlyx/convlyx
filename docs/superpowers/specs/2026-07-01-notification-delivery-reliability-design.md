# Notification delivery reliability — design spec

**Date:** 2026-07-01
**Status:** Approved design — ready for implementation plan
**Parent:** `docs/TODO.md` §3 "Notifications fired outside transactions" (the remaining open item).

## Context & problem

Notifications are created **after** and **outside** the business transaction, fire-and-forget
with a `.catch()` that only logs (`src/server/lib/notifications.ts`; ~10 call sites across
`class` / `enrollment` / `exam` / `course` / `user` routers + the reminders cron). Two gaps:

1. **The in-app `Notification` row can be silently lost.** The business write commits, then
   `createNotification` runs separately; if its insert fails, the business op still succeeded
   but the user never gets the notification — swallowed by the `.catch`.
2. **The push can be cut off.** The post-commit push is fire-and-forget with no
   `waitUntil`/`after`, so when the serverless function returns the response the push promise
   may be terminated mid-flight — some pushes are likely dropped today. And a transient push
   failure (timeout / 5xx) is given a single attempt, then logged and lost.

## Decision (locked)

**Approach A + in-process resilient push.** Write the `Notification` row *inside* the business
transaction (atomic — never silently lost), and send push as **guaranteed background work**
(`after()` / `waitUntil`) with a **small in-process retry** on transient failures. **No outbox
table, no cron.**

**Rejected alternatives:**
- *Full transactional outbox (B)* and *push-only sweep-outbox (C)*: both need a **frequent
  sweep cron**, but Vercel Hobby crons run at most **once/day** — so they'd depend on Vercel
  Pro or an external pinger. The only thing a sweep buys over in-process retry is covering a
  crash in the ~ms between commit and the push call — during which the in-app notification
  still persists. Not worth the cron dependency now. If evidence later shows it's needed, the
  sweep can be added then (it's the piece that reintroduces the cron).

## Design

### 1. Split the two concerns in `src/server/lib/notifications.ts`

Today one function does both the DB row and the push. Split them:

- **`recordNotification(client, params) → PushJob | null`** — inserts **one** `Notification`
  row via the passed `client` (an interactive-transaction `tx` or `db`). Returns a `PushJob`
  when push content (`pushTitle`/`pushBody`) was supplied, else `null`. **No push here.**
- **`recordNotifications(client, params) → PushJob | null`** — same via `createMany` for a
  `userIds` list.
- **`dispatchPush(db, jobs: (PushJob | null)[]): void`** — filters nulls and, for each job,
  schedules a **guaranteed background** push (see §3). Never throws; never awaited by callers.
- **`type PushJob = { tenantId: string; userIds: string[]; title: string; body: string; url?: string }`**

Keep `formatClassTime` as-is. The `Notification` row still stores i18n **keys** (`title`,
`message`) + `data` for the in-app view; push strings live only in the transient `PushJob`.

### 2. Call-site pattern (unify on the interactive-transaction idiom)

Each of the ~10 sites wraps the business mutation **and** the notification insert in one
`ctx.db.$transaction(async (tx) => …)`, collects push jobs, and dispatches after commit:

```ts
const jobs: (PushJob | null)[] = [];
await ctx.db.$transaction(async (tx) => {
  await tx.<businessMutation>(...);            // the real change
  jobs.push(await recordNotifications(tx, {...}));  // notification row(s) — SAME tx
});
dispatchPush(ctx.db, jobs);                    // guaranteed-background push, after commit
```

The two array-form transactions (`class.cancel`, `course.abandon`) convert to this interactive
form (behavior-equivalent). Sites with no current transaction (single `create` then notify)
gain a transaction wrapper. The tenant-scope extension applies to the `tx` client (already
relied on by `user.anonymize`'s interactive transaction), so `tx.notification.create`
auto-injects `tenantId`.

### 3. Guaranteed-background push with retry (`dispatchPush`)

- Use Next.js 16's **`after()`** (`import { after } from "next/server"`) to run the push after
  the response is sent, within the same (Fluid Compute) invocation — no new dependency, no
  blocking the mutation response. (Fallback if `after()` is not usable from the tRPC route
  handler: `waitUntil` from `@vercel/functions`; verify at implementation time — see Open items.)
- Inside, per `PushJob`, send via the existing `sendPushToUsers` with a **retry loop: up to 3
  attempts, short backoff** (e.g. 500ms → 1.5s) on *transient* failures. 404/410 still prune
  the dead subscription (unchanged). `Promise.allSettled` across subscriptions (unchanged).
- Retries stay in-process (complete within seconds), so a resent push is never stale, is
  capped (no spam), and is one dispatch per notification (no duplicates).

### 4. Cron reminders (`src/app/api/cron/reminders/route.ts`)

Switch to `recordNotifications(db, …)` + `dispatchPush(db, jobs)`. **No transaction** — reminders
are independent and the job re-runs daily, so a per-item insert failure just logs and continues
(unchanged semantics). Push still goes through the resilient `dispatchPush`.

## Behavior change to be explicit about

If a notification-row insert fails, it now **rolls back the business op** (the request errors)
instead of silently swallowing. This only happens on a real DB error that would fail the write
anyway — failing loudly beats losing the notification, which is the point.

## Testing

- **Unit** (`tests/notifications.test.ts`): `recordNotification` writes a row with the right
  fields and returns the expected `PushJob` (and `null` when no push content).
- **Integration** (extend the two-tenant helper suite): after `enrollment.enroll` (staff
  enrolling another student) a `Notification` row exists for that student in the same tenant;
  and a transaction that throws *after* `recordNotification` leaves **no** orphaned row
  (atomicity).
- **Push retry** (unit, mock `web-push`): a transient failure then success results in the push
  being delivered (retry works); a 410 prunes the subscription and does not retry.
- Push itself is not asserted end-to-end (it's a best-effort external side effect).

## Non-goals

- No `Outbox`/`Event` table; no sweep cron; no per-notification push-state columns.
- No guarantee of push delivery across a crash in the commit→dispatch window (in-app row covers
  the user; add a sweep later only if evidence demands it).
- No change to the in-app notification data shape or the client rendering.

## Open items (verify at implementation time)

- **`after()` usability from the tRPC route handler** (`src/app/api/trpc/[trpc]/route.ts`).
  Confirm `after()` from `next/server` runs the push post-response on the current Vercel setup;
  if not, fall back to `waitUntil` from `@vercel/functions` (adds that dependency). Either way,
  the retry logic is identical — only the "keep the function alive" mechanism differs.

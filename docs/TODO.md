# TODO — Hardening backlog

Risk-ordered list of unsexy-but-important work pulled from `FUTURE.md` and the code audit. Tick items off as they ship.

Last reviewed: 2026-05-11.

---

## 1. Security & correctness (do first)

- [x] **Instructor authorization scoping** — `enrollment.markAttendance`, `enrollment.addNote`, `enrollment.bulkMarkAttendance` accept any class in the tenant. Add `session: { instructorId: ctx.user.id }` filter when `ctx.user.role === "INSTRUCTOR"`. (`src/server/routers/enrollment.ts`)
- [ ] **Supabase RLS policies** — none currently exist. Add tenant-scoped policies on `enrollments`, `class_sessions`, `users`, `notifications`, `student_courses`, `exams` keyed on `tenant_id`. CLAUDE.md already documents this as the defence-in-depth layer; right now it's documentation only.
- [ ] **Rotate Supabase + VAPID keys** — shared during dev, treat as compromised. Update Vercel + `.env.prod`.
- [x] **Cap `enrollment.addNote` length** — currently unbounded `z.string()`. Add `.max(2000)`.
- [x] **`PushSubscription` lacks `tenantId`** — schema change so a tenant-moved user can't be pushed to from the wrong tenant. Backfill existing rows during migration.
- [ ] **CSRF validation on POST API routes** — `src/app/api/webhooks/*` and any same-origin POST endpoints.
- [x] **Replace hardcoded seed password** with env var.
- [ ] **CAPTCHA on repeated failed logins** — basic abuse defence.
- [ ] **MFA for platform admin accounts**.
- [x] **Content Security Policy (CSP) header** — v1 baseline shipped in `next.config.ts`. `script-src` still needs `'unsafe-inline'`/`'unsafe-eval'` (Next.js hydration requirement); follow-up: per-request nonces via middleware to tighten script-src.

## 2. Scale walls

- [x] **Server-side pagination** — `class.list`, `user.list`, and `enrollment.listByStudent` all migrated to optional `page`/`pageSize`/`search` params returning `{ items, total }`. All UI consumers updated. Student-profile and instructor-profile history sections still paginate client-side (single-user data, bounded volume).
- [ ] **Distributed rate limiting** — current in-memory limiter is per-instance. Move to Upstash Redis (or similar) so it actually limits across multi-instance Vercel deploys.

## 3. Operational holes (you'll regret skipping after first real users)

- [ ] **Sentry / error monitoring** — production errors are invisible right now.
- [ ] **Structured logging** — pair with Sentry; replace ad-hoc `console.error`.
- [x] **CI pipeline** — GitHub Actions workflow at `.github/workflows/ci.yml` runs lint + type-check on every push to main and every PR. Tests still TODO (no test suite yet).
- [ ] **Tenant-isolation integration tests** — the single most important test suite that doesn't exist. Hits every `*.list` / `*.get` procedure across two tenants and asserts no cross-tenant leakage.
- [ ] **E2E tests (Playwright)** — at minimum the golden paths: login, create class, enrol student, mark attendance.
- [ ] **Audit logging for platform-admin actions** — tenant/school create/edit, user impersonation if added.
- [x] **16 silent `.catch(() => {})` on notification calls** — replace with at least `console.warn`. Long-term: move to event-driven pattern so notifications can't desync from the DB write.
- [ ] **Notifications fired outside transactions** — DB write succeeds, notification call can fail silently. Consider wrapping in transaction (with care — long-running side effect) or moving to an outbox/event-driven pattern.

## 4. Tech debt with real consequences

- [ ] **Zod schemas inline in routers** (`enrollment.ts`, `user.ts`, `class.ts`, `notification.ts`) should move to `src/lib/validations/`. Will bite during the React Native split.
- [x] **`as unknown as string` Date casts in 6 places** — root cause confirmed: superjson IS correctly propagating Dates client-side. Removed all casts; types now flow through as `Date` as expected.
- [ ] **Extract `useUrlParam` hook** — URL-param sync (`useState` + `router.replace` + `useEffect(() => setPage(1), [...])`) is duplicated across 5 list components.
- [x] **`ITEMS_PER_PAGE = 10` duplicated in 7 components** — extract to `src/lib/constants/pagination.ts`.
- [ ] **Inconsistent error key namespacing** — `users.notFound` / `enrollment.notFound` / `classes.notFound`. Pick one convention (recommend singular `user.notFound`).
- [ ] **Calendar event hex colors** (`class-calendar.tsx:21-33`) have no dark mode variants — events look identical in dark mode. Move to CSS variables.
- [x] **`roleColorMap` defined but unused** — either apply it on user/instructor lists for visual consistency or delete it.
- [x] **`enrolledSessionIds` in `classes-table.tsx:68`** rebuilds a `Set` per render — wrap in `useMemo`.
- [x] **Platform-admin admin-creation rollback is best-effort** — added pre-flight duplicate-email check so the rollback only fires on rare race/FK failures; orphan auth user id is now logged with `console.error` (not warn) so an operator can clean up via dashboard.
- [x] **Hardcoded `themeColor: "#16a34a"` in `app/layout.tsx:23`** — doesn't match primary token. Replace with CSS-var lookup or define a single source.
- [x] **English "Close" `sr-only` label** in `dialog.tsx:77` — translation key.
- [ ] **Default Button size still below iOS HIG 44px** — bumped to h-9 (36px) but mobile primary actions should be `size="lg"` or the default should grow further.

## 5. Compliance follow-ups

- [ ] **GDPR data export** — full export of a user's data as JSON/CSV. Required for Art. 15 / 20 requests.
- [ ] **GDPR hard-delete for users with history** — partially done: students/instructors with no `Enrollment`/`Exam` (and no `ClassSession` for instructors) can already be hard-deleted. The remaining case is users *with* history → anonymize-in-place (replace name/email/phone with `[deleted]`, keep FK rows intact). ADMIN-only flow, separate from the existing delete button.
- [ ] **Data processing agreement template** for schools to sign on signup.
- [ ] **Backfill `category` for legacy `class_sessions`** rows (currently nullable, required at validation layer for new rows). One-time admin tool or seed script.

## 6. License / exam follow-ups (from existing FUTURE.md)

- [ ] Defence-in-depth: partial unique index in Postgres enforcing one `IN_PROGRESS` `StudentCourse` per student (currently only validated at the tRPC layer).
- [ ] Conflict detection between class schedule and accompanying exam schedule for the same instructor.
- [ ] Cross-category stats on student profile (per-category attendance & exam pass rate).
- [ ] PDF export of full course report (course + exams + classes attended) per category.
- [ ] When abandoning a course, optionally archive related future enrollments.

---

## Stale entries to remove from FUTURE.md

Already shipped — clean up the doc:

- ~~Privacy policy / Terms of service / Cookie consent banner~~ (shipped `9fd250d`, `5c18c14`).
- ~~Move from `prisma db push` to proper migrations~~ (done; we use `prisma migrate` with the known prod-routing manual-paste workflow).
- ~~Tenant-level feature flag for practical self-booking~~ (already marked done in FUTURE.md, just needs to drop off the list).

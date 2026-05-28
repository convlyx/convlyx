# TODO — Hardening backlog

Risk-ordered list of unsexy-but-important work pulled from `FUTURE.md` and the code audit. Tick items off as they ship.

Last reviewed: 2026-05-11.

---

## 1. Security & correctness (do first)

- [x] **Instructor authorization scoping** — `enrollment.markAttendance`, `enrollment.addNote`, `enrollment.bulkMarkAttendance` accept any class in the tenant. Add `session: { instructorId: ctx.user.id }` filter when `ctx.user.role === "INSTRUCTOR"`. (`src/server/routers/enrollment.ts`)
- [x] **Tenant-scope defense in depth** — shipped as a Prisma client extension (`src/server/lib/tenant-scope.ts`) wired into `protectedProcedure`. Every authenticated tRPC query against a tenant-scoped model auto-injects `tenantId` into `where`/`data`, cross-tenant values supplied by callers are overridden, and `findUnique` on scoped models is forbidden (use `findFirst`). RLS was the original plan but Prisma connects as Postgres superuser, which bypasses RLS — so the extension is the actual defense layer for this architecture. If the Supabase JS client is ever wired to read app data from the browser, proper RLS policies must be added at that point. Covered by `tests/tenant-scope.test.ts`.
- [ ] **Rotate Supabase + VAPID keys** — shared during dev, treat as compromised. Update Vercel + `.env.prod`.
- [x] **Cap `enrollment.addNote` length** — currently unbounded `z.string()`. Add `.max(2000)`.
- [x] **`PushSubscription` lacks `tenantId`** — schema change so a tenant-moved user can't be pushed to from the wrong tenant. Backfill existing rows during migration.
- [x] **CSRF validation on POST API routes** — `isSameOrigin(headers)` helper in `src/lib/csrf.ts`, applied to all 6 POST routes (push subscribe/unsubscribe, platform-admin admins/schools/tenants, demo-request) and the tRPC POST handler (mutations). Belt-and-braces on top of Supabase's SameSite=Lax cookies. Cron route uses CRON_SECRET bearer auth — separate concern.
- [x] **Replace hardcoded seed password** with env var.
- [ ] **CAPTCHA on repeated failed logins** — basic abuse defence.
- [ ] **MFA for platform admin accounts**.
- [x] **Content Security Policy (CSP) header** — v1 baseline shipped in `next.config.ts`. `script-src` still needs `'unsafe-inline'`/`'unsafe-eval'` (Next.js hydration requirement); follow-up: per-request nonces via middleware to tighten script-src.

## 2. Scale walls

- [x] **Server-side pagination** — `class.list`, `user.list`, and `enrollment.listByStudent` all migrated to optional `page`/`pageSize`/`search` params returning `{ items, total }`. All UI consumers updated. Student-profile and instructor-profile history sections still paginate client-side (single-user data, bounded volume).
- [ ] **Distributed rate limiting** — current in-memory limiter is per-instance. Move to Upstash Redis (or similar) so it actually limits across multi-instance Vercel deploys.

## 3. Operational holes (you'll regret skipping after first real users)

- [x] **Sentry / error monitoring** — wired up; production errors trigger email alerts via Sentry.
- [x] **Structured logging** — `src/lib/logger.ts` with `info`/`warn`/`error`. Dev output is pretty; prod emits JSON lines so Vercel runtime logs can parse them. `error` auto-captures to Sentry (passes `error: e` in context for proper stack). All server-side `console.*` (server routers, server/lib, api routes) migrated. Client-side `console.*` (3 files) left for a follow-up.
- [x] **CI pipeline** — GitHub Actions workflow at `.github/workflows/ci.yml` runs lint + type-check on every push to main and every PR. Tests still TODO (no test suite yet).
- [x] **Tenant-isolation integration tests** — Vitest set up; `tests/isolation.test.ts` covers `class.list`, `user.list`, `enrollment.listByStudent` (staff path), and `user.studentProfile` cross-tenant rejection. Helper in `tests/helpers/tenant.ts` seeds two fresh tenants per test file with random UUIDs and cleans up after. CI runs against a Postgres service container with migrations applied. Pattern set — add more procedures as needed.
- [x] **E2E tests (Playwright)** — v1 (admin login, enrol, mark attendance, cancel class) + v2 (no-show attendance, remove enrolment, instructor login with role-scoped nav). 7 tests total, ~35s wall time. Lives in `e2e/`, runs via `pnpm e2e` against the local dev server. Test data is created via raw `pg` (Prisma 7's ESM-only client can't be required from Playwright's CJS loader) and cleaned up per-test. Local-only for now — CI integration is a separate follow-up (needs a Supabase test project + workflow secrets). Follow-ups: create-class flow (date picker + recurrence — its own PR), notifications surface check, student-side dashboard.
- [x] **Audit logging for platform-admin actions** — new `audit_logs` table (`actor_email`, `action`, `target_type`, `target_id`, `metadata`, `created_at`). `audit()` helper in `src/server/lib/audit.ts` is best-effort (failures log but don't abort the caller). Wired into `api/platform-admin/{tenants,schools,admins}` so each successful create writes a row. Not tenant-scoped — these actions cut across tenants. Browse UI at `/platform-admin/audit` with filters by action and actor; shows the most recent 100 entries with metadata expanded as JSON.
- [x] **16 silent `.catch(() => {})` on notification calls** — replace with at least `console.warn`. Long-term: move to event-driven pattern so notifications can't desync from the DB write.
- [ ] **Notifications fired outside transactions** — DB write succeeds, notification call can fail silently. Consider wrapping in transaction (with care — long-running side effect) or moving to an outbox/event-driven pattern.

## 4. Tech debt with real consequences

- [x] **Zod schemas inline in routers** (`enrollment.ts`, `user.ts`, `class.ts`, `notification.ts`) should move to `src/lib/validations/`. Extracted the meaningful multi-field schemas: `listClassesSchema`, `listUsersSchema`, `enrollSchema`, `markAttendanceSchema`, `addNoteSchema`, `bulkSetAttendanceSchema`, `bulkMarkAttendanceSchema`, `listByStudentSchema`, `listNotificationsSchema`. Single-field id schemas (`z.object({ id: z.string().uuid() })`) intentionally left inline — extracting them creates noise without value.
- [x] **`as unknown as string` Date casts in 6 places** — root cause confirmed: superjson IS correctly propagating Dates client-side. Removed all casts; types now flow through as `Date` as expected.
- [x] **Extract `useUrlParam` hook** — `useUrlParam` + `useUrlParamInt` in `src/hooks/use-url-param.ts`. URL is the source of truth (reads derive on every render); writes use `router.replace` with default-value elision (URL stays clean when value matches default). Applied across `students-page-client`, `instructors-page-client`, `users-table`, `classes-table`. `classes-table` keeps a custom `setTimeTab` that orchestrates the three URL updates for the tab+status+page reset.
- [x] **`ITEMS_PER_PAGE = 10` duplicated in 7 components** — extract to `src/lib/constants/pagination.ts`.
- [x] **Inconsistent error key namespacing** — all i18n keys now use the plural route-name convention. `enrollment.X` → `enrollments.X` across server messages, the `enrollment` block in pt-PT.json, and all UI callers. Notification `type:` values (e.g. `"enrollment.created"`) intentionally kept — they're data, not translations.
- [x] **Calendar event hex colors** — moved to CSS variables in `globals.css` (`--calendar-*` tokens) with light + dark variants. `class-calendar.tsx` passes `var(--…)` to FullCalendar's `backgroundColor`/`borderColor` inline-style props so events flip with the theme. Vivid enrolled colors slightly darkened in dark mode; "available" pastels brought down to deep tinted backgrounds for readability.
- [x] **`roleColorMap` defined but unused** — either apply it on user/instructor lists for visual consistency or delete it.
- [x] **`enrolledSessionIds` in `classes-table.tsx:68`** rebuilds a `Set` per render — wrap in `useMemo`.
- [x] **Platform-admin admin-creation rollback is best-effort** — added pre-flight duplicate-email check so the rollback only fires on rare race/FK failures; orphan auth user id is now logged with `console.error` (not warn) so an operator can clean up via dashboard.
- [x] **Hardcoded `themeColor: "#16a34a"` in `app/layout.tsx:23`** — doesn't match primary token. Replace with CSS-var lookup or define a single source.
- [x] **English "Close" `sr-only` label** in `dialog.tsx:77` — translation key.
- [x] **Default Button size and iOS HIG** — fixed the `lg` variant (it was `h-9`, same as default — clearly a typo when the size ladder was last touched) to be properly `h-11` (44px, iOS HIG). Default stays `h-9` to avoid making every button on the site chunky on desktop. Pattern going forward: use `size="lg"` for any button that's a mobile primary CTA (login form already updated; landing-page CTAs already used `lg` so they got the bump for free).

## 5. Compliance follow-ups

- [x] **GDPR data export** — `user.exportData` (ADMIN-only, tenant-scoped) returns a complete JSON dump: profile + studentCourses (with exams) + enrollments + instructedSessions + accompaniedExams + notifications + pushSubscriptions. Top-level `exportedAt` + `format: "convlyx.gdpr.v1"` for forward-compat. UI lives in a dedicated "RGPD" tab in `/settings` (ADMIN-only) — search a user by name/email, click Export → downloads `dados-{name}-{YYYY-MM-DD}.json`. Per-user detail pages don't surface it; it's a rare compliance action and stays out of common flows.
- [x] **GDPR hard-delete for users with history** — anonymize-in-place shipped as `user.anonymize`. ADMIN-only, STUDENT/INSTRUCTOR only, self forbidden. Strips PII (`name → "Anonimizado"`, `email → anonimizado-{id}@convlyx.invalid`, `phone → null`), marks INACTIVE, wipes notifications + push subscriptions, deletes Supabase Auth row (404 tolerated). Historical FK rows (enrollments, classes, exams, courses) stay intact. Detail-page button shows the right action based on `user.deletable` — delete when no history, anonymize when there is.
- [ ] **Data processing agreement template** for schools to sign on signup.
- [x] **Backfill `category` for legacy `class_sessions`** rows — intentionally skipped on prod. Legacy NULL rows are kept as-is for historical accuracy; new rows are required at the validation layer. Column stays nullable until we have a confident inference strategy (or accept lossy default).

## 6. License / exam follow-ups (from existing FUTURE.md)

- [x] Defence-in-depth: partial unique index in Postgres enforcing one `IN_PROGRESS` `StudentCourse` per student per category (currently only validated at the tRPC layer). Migration `20260517102730_add_unique_in_progress_course_per_category` — partial index on `(student_id, category) WHERE status = 'IN_PROGRESS'`.
- [x] Conflict detection between class schedule and accompanying exam schedule for the same instructor. `hasInstructorScheduleConflict` helper in `src/server/lib/schedule-conflict.ts` checks both `class_sessions` and `exams` (60-min slot) for a given instructor + windows. Wired into `class.create` (one-off + recurring), `class.update`, `exam.schedule`, `exam.update`. Tests in `tests/instructor-schedule.test.ts`.
- [x] Cross-category stats on student profile (per-category attendance & exam pass rate). Each active course card on the student detail page now shows practical attendance (X/Y + %) and exam result counts scoped to that category. Theory stays at the top-level aggregate (category-agnostic). Computed client-side from `user.studentProfile`'s existing payload — no new endpoint.
- [x] PDF export of full course report (course + exams + classes attended) per category. `exportCourseProgressPDF` in `src/lib/pdf-export.ts` renders one PDF per `StudentCourse`: student + course header, practical-only attendance stats scoped to that category, exam-result counts, exam history table, and a practical class history table. Triggered from the "Exportar PDF" button on each active course card on the student detail page.
- [x] When abandoning a course, archive related future enrollments. `course.abandon` now cancels future `ENROLLED` enrollments in classes of the same category (plus `THEORY` classes if the student has no other in-progress course). All inside one transaction. The student gets a notification with the count.

---

## Stale entries to remove from FUTURE.md

Already shipped — clean up the doc:

- ~~Privacy policy / Terms of service / Cookie consent banner~~ (shipped `9fd250d`, `5c18c14`).
- ~~Move from `prisma db push` to proper migrations~~ (done; we use `prisma migrate` with the known prod-routing manual-paste workflow).
- ~~Tenant-level feature flag for practical self-booking~~ (already marked done in FUTURE.md, just needs to drop off the list).

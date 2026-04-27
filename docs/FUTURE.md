# Future Features, Concerns & Ideas

Living document of things to build, improve, or investigate post-MVP.

---

## Security
- [ ] Rotate all Supabase keys and VAPID keys (shared during development)
- [ ] Distributed rate limiting with Upstash Redis (current in-memory is per-instance)
- [ ] MFA for platform admin accounts
- [ ] CSRF token validation on POST API routes
- [ ] Replace hardcoded seed password with env var
- [ ] Audit logging for platform admin actions (tenant/school creation)
- [ ] Add CAPTCHA on repeated failed login attempts
- [ ] Content Security Policy (CSP) header

## Mobile App
- [ ] React Native (Expo) app consuming the same tRPC API
- [ ] Student-focused first: view calendar, enroll, cancel
- [ ] Instructor view: see schedule, mark attendance, add notes
- [ ] Share Zod schemas and types via monorepo (Turborepo)
- [ ] Push notifications via native push (APNs/FCM)

## Multi-Tenancy
- [ ] Same email across multiple tenants — decouple `User.id` from Supabase `auth.id` so one auth account can have a User row per tenant. Login resolves the correct User based on the subdomain. Currently Supabase enforces email uniqueness in `auth.users`, blocking same-email admins across schools.
- [ ] Multi-school users — instructor/secretary working across schools in same tenant
- [ ] DB-per-tenant migration when scaling beyond free tier
- [ ] Per-tenant accent color / branding customization
- [ ] Tenant-level feature flags (enable/disable practical self-booking per school)
- [ ] Custom domain per school (escola.pt instead of escola.convlyx.com)

## Classes & Scheduling
- [ ] IMT category tracking (A, A1, A2, B, B1, etc.)
- [ ] Vehicle/fleet management
- [ ] Instructor availability management (recurring schedules, holidays)
- [ ] Waiting lists for full classes
- [ ] Class templates (pre-defined types with default settings)
- [ ] Bulk class creation improvements (multi-day, multi-instructor)
- [ ] Conflict detection for students (can't enroll in overlapping classes)

## Payments & Billing
- [ ] Payment processing (Stripe integration)
- [ ] Subscription management per tenant
- [ ] Invoice generation
- [ ] Student payment tracking (paid/pending per enrollment)
- [ ] Usage-based billing (per student, per class)

## Communication
- [ ] Custom SMTP for branded emails (Resend/SendGrid)
- [ ] Email notifications alongside push (class reminders, cancellations)
- [ ] SMS notifications (Twilio)
- [ ] WhatsApp Business API integration
- [ ] In-app messaging between instructor and student

## Data & Reporting
- [ ] CSV export for all lists (students, classes, enrollments)
- [ ] Monthly attendance reports with charts
- [ ] Student progress dashboard with completion tracking
- [ ] School-wide analytics (enrollment trends, attendance rates)
- [ ] IMT compliance reports
- [ ] Print-friendly views for all reports

## UX Improvements
- [ ] Dark mode toggle
- [ ] Breadcrumbs for navigation depth
- [ ] Keyboard shortcuts for power users
- [ ] Drag-and-drop on calendar (reschedule classes)
- [ ] Student photo upload
- [ ] Onboarding wizard for new schools
- [ ] Pagination on all lists (cursor-based)
- [ ] Infinite scroll as alternative to pagination
- [ ] Skeleton loading states (instead of dots)
- [ ] Offline support in PWA (view cached schedule)

## Platform Admin
- [ ] Edit/delete tenants and schools
- [ ] View/manage users across tenants
- [ ] Impersonate user (login as any user for support)
- [ ] Platform-wide analytics dashboard
- [ ] Subscription/billing management
- [ ] Feature flag management per tenant
- [ ] Support ticket system

## Superadmin (post-MVP)
- [ ] SuperAdmin table with email allowlist (decoupled from tenant Users)
- [ ] Superadmin UI on root domain or separate subdomain (e.g. `super.convlyx.com`)
- [ ] Tenant access for support — "enter tenant" flow with same access as tenant admin
- [ ] Audit log of superadmin actions (which tenant entered, when, what was changed) — GDPR-relevant

## Technical Debt
- [ ] Zod schema validation messages should be i18n (need architectural change)
- [ ] Replace base-ui Select with Radix Select everywhere (some remnants)
- [ ] Move from `prisma db push` to proper migrations
- [ ] Add integration tests for tenant isolation
- [ ] Add E2E tests (Playwright)
- [ ] Error monitoring (Sentry)
- [ ] Structured logging
- [ ] CI pipeline with lint + type-check + tests on PR

## Code Quality (from audit)
- [ ] **Instructor authorization scoping** — `enrollment.markAttendance`, `addNote`, `bulkMarkAttendance` allow any instructor in the tenant to act on any class. Add `session: { instructorId: ctx.user.id }` filter when role is INSTRUCTOR.
- [ ] **Cap `enrollment.addNote` notes length** — currently unbounded `z.string()`; add `.max(2000)`.
- [ ] **Supabase RLS policies** — defense-in-depth on `enrollments`, `class_sessions`, `users`, `notifications` keyed on `tenant_id`. CLAUDE.md documents this as defense-in-depth but no policies exist.
- [ ] **Cursor-based pagination** — all list pages currently fetch everything client-side then `.slice()`. Won't scale past a few hundred records per tenant.
- [ ] **`as unknown as string` casts on Date fields** in 6 places (`classes-table.tsx:102`, `enrollments-list.tsx:52,54`, `dashboard-view.tsx:58`, `class-calendar.tsx:92,93`). Symptom of tRPC superjson types not being trusted.
- [ ] **Inconsistent error key namespacing** — `users.notFound`, `enrollment.notFound`, `classes.notFound`. Pick one convention (recommend plural).
- [ ] **Inline Zod schemas scattered across routers** — should live in `src/lib/validations/`. Currently in `enrollment.ts`, `user.ts`, `class.ts`, `notification.ts`.
- [ ] **`ITEMS_PER_PAGE = 10` duplicated** in 7 components — extract to `src/lib/constants/pagination.ts`.
- [ ] **`useUrlParam` hook** — extract the URL-param sync pattern (`useState` + `router.replace` + `useEffect(() => setPage(1), [...])`) duplicated across 5 list components.
- [ ] **16 silent `.catch(() => {})` on notification calls** — no telemetry on failures. Add at least `console.warn` inside catches.
- [ ] **Notifications fired outside transactions** — DB write succeeds but notification can fail silently, leaving inconsistent state. Consider event-driven pattern post-MVP.
- [ ] **Default Button size** — bumped to h-9 (36px) for mobile tap target. Still below 44px iOS HIG recommendation. Consider increasing further or using `size="lg"` everywhere on mobile primary actions.
- [ ] **Calendar event hex colors** (`class-calendar.tsx:21-33`) don't have dark mode variants — events look identical in dark mode. Move to CSS vars.
- [ ] **Roles "secondary" badges everywhere** — `roleColorMap` is defined and unused. Either use it on user/instructor lists for visual consistency or delete.
- [ ] **Rebuild `Set` per render in `classes-table.tsx:68`** — wrap `enrolledSessionIds` in `useMemo`.
- [ ] **`PushSubscription` has no `tenantId` column** — could fire wrong-tenant push if user is moved across tenants.
- [ ] **Platform-admin admin creation rollback is best-effort** — wrap in Prisma transaction or add proper compensation logic.
- [ ] **Hardcoded `themeColor: "#16a34a"` in `app/layout.tsx:23`** — doesn't match the actual primary token.
- [ ] **`<span className="sr-only">Close</span>` in `dialog.tsx:77`** — English leak in a11y label, should use translation key.

## Legal & Compliance
- [ ] GDPR data export (all user data as JSON/CSV)
- [ ] GDPR right to deletion (hard delete path)
- [ ] Privacy policy page
- [ ] Terms of service page
- [ ] Cookie consent banner
- [ ] Data processing agreement template for schools

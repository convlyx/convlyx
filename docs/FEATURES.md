# Features Inventory

Living document of everything the app can do, organized by area.

---

## Authentication & Authorization
- Email/password login via Supabase Auth
- Role-based access: ADMIN, SECRETARY, INSTRUCTOR, STUDENT
- Server-side role checks on all pages (redirect if unauthorized)
- tRPC middleware enforces role permissions on all API endpoints
- Session refresh via middleware on every request
- User invite via email — new users set their own password (no temp passwords)
- Password reset flow (email link via Supabase)
- Update password page after reset
- Subdomain-tenant validation — users can only log in on their tenant's subdomain
- Client-side tenant validation on login (immediate feedback, no redirect dance)
- Server-side tenant validation as defense in depth
- Logout

## Multi-Tenancy
- Tenant resolved from subdomain (`demo.convlyx.com`)
- All queries scoped by `tenant_id` — no cross-tenant data access
- Supabase RLS as defense in depth
- tRPC context validates subdomain matches user's tenant
- Root domain (`convlyx.com`) blocked — shows landing page, requires subdomain
- Tenant name editable in settings (admin only)
- Tenant name displayed in sidebar, header, and mobile nav

## Schools
- List schools (card + table view toggle)
- Create school (admin only)
- Edit school info in settings (admin, secretary)
- School count badges (users, classes)

## Users
- `/students`, `/instructors`, and `/staff` are the three role-specific lists; `/staff` (admin only) lists ADMIN + SECRETARY together. A single shared `/users` tab was removed in favour of per-role tabs so each role has one canonical place to be managed.
- List filters (role, school) and search
- Card + table view toggle
- Invite user via email — Supabase sends password setup link (admin, secretary)
- Edit user (name, phone, role, school)
- Phone number field on user creation and editing (optional)
- Deactivate / activate user (admin + secretary; secretary can't touch ADMIN or SECRETARY targets) with confirmation dialog
- Row actions (Edit + Deactivate/Activate) exposed on every role-specific list; same actions on the detail-page header so the list and detail expose an identical primary action set
- Hard-delete student or instructor (admin only) lives in a slim "Danger zone" row at the bottom of the detail page — surfaces only when the user has no `Enrollment` / `Exam` history (instructors also gated on `ClassSession` and audit FKs). Cascades `Notification`, `PushSubscription`, and (for students) `StudentCourse` rows; also removes the Supabase Auth account in the same transaction. Staff (admin/secretary) stay deactivate-only.
- Anonymize-in-place (admin only, GDPR Art. 17) — when the user *has* history and hard-delete is unavailable, the danger zone instead offers "Anonimizar". Replaces name/email/phone with placeholders, marks INACTIVE, wipes notifications + push subscriptions, deletes the Supabase Auth row. Historical FK rows (enrollments, taught classes, exams) stay intact so reports and records aren't silently rewritten — the person is just unidentifiable.
- GDPR data export (admin only, Art. 15 — right of access). Dedicated "RGPD" tab under `/settings`: admin searches a user by name/email, clicks Export → downloads a complete JSON dump (profile + courses + exams + enrollments + taught classes + accompanied exams + notifications + push subscriptions), with an `exportedAt` timestamp and a versioned format tag. Intentionally separated from per-user detail pages — rare compliance action, kept out of everyday flows.
- Role-colored avatars (purple=admin, blue=secretary, green=instructor, primary=student)
- Create user directly from each list ("Adicionar aluno" / "Adicionar instrutor" / "Adicionar membro") with the role pre-locked or limited to the relevant subset
- Filter students/instructors list by status (Ativo / Inativo / Todos) — defaults to active only

## License Categories (IMT)
- All 14 Portuguese categories supported: AM, A1, A2, A, B1, B, BE, C1, C1E, C, D1, D1E, D, DE
- Category labels with descriptions on every selector (e.g. "B — Automóveis ligeiros")
- Required on every class (legacy rows kept nullable; new classes require category at validation layer)
- Required on student creation (selects initial license category, creates a `StudentCourse`)
- Optional `qualifiedCategories[]` on instructors (categories they can teach)
- When a category is selected on class create/edit, instructor list filters to only those qualified for it
- Category badge shown on class cards, class table, class detail page, calendar, student lists, student profile, enrollment history

## Driving Courses (StudentCourse)
- Each student has one active course (single category) at a time, with full course history
- "Iniciar carta de condução" action on student profile (admin/secretary) — picks a category, blocked if a carta de condução is already active
- "Concluir carta de condução" / "Abandonar carta de condução" actions with confirmation modals
- Abandoning a course also cancels the student's future `ENROLLED` enrollments in classes of that category (plus `THEORY` classes if no other in-progress course remains). One transaction, one notification to the student with the count.
- Carta de condução history list per student with status badges (Em curso / Concluída / Abandonada), start date, completion date
- After completing/abandoning a course, the student can start a new one in a different (or the same) category

## Exams
- Per-attempt exam records (full retake history)
- Theory and Practical exam types
- Schedule exam from student profile — date/time, optional location, optional accompanying instructor
- Accompanying instructor list filtered to those qualified for the course's category
- Exam results: SCHEDULED → PASSED / FAILED / NO_SHOW / CANCELLED
- Admin/secretary can record any result; instructor can mark NO_SHOW only on exams they accompany
- Exam cancellation (only while still SCHEDULED)
- Notifications: scheduled (student + instructor), result recorded (student), cancelled (student + instructor)
- Day-before reminder included in existing daily cron (student + accompanying instructor)
- Exams render on the calendar alongside classes — distinct red palette, exam legend, dedicated exam detail dialog
- Exam detail dialog: student link, schedule, location, accompanying instructor, examiner notes, result-marking and cancel actions
- Students see only their own exams on the calendar; instructors see only exams they accompany

## Classes
- List classes with filters (type, school, category) and search
- Card + table view toggle
- Past / upcoming tabs with URL sync
- Clickable cards → class detail page (admin, secretary)
- Create class — one-off or recurring (by day of week + date range)
- Practical classes: capacity limited to 1-4 students, assign students on creation via searchable picker
- Theory classes: configurable capacity, students self-enroll
- Edit class (instructor, title, capacity, date/time) with confirmation
- Schedule conflict detection: prevents creating/editing classes when instructor already has a class at that time
- Cancel class with confirmation dialog (cascades to all enrollments)
- Class detail page (`/classes/[id]`) for secretary/admin: full class info, student list, add/remove students, attendance, cancel class
- Instructor access to own class detail pages: view class info, mark attendance, bulk mark, edit notes (no add/remove students or cancel)
- Student names link to student profile, instructor name links to instructor profile
- Auto status management: SCHEDULED → IN_PROGRESS → COMPLETED based on time
- Class type badges color-coded (blue=theory, green=practical) consistently across entire app
- Status badges (Agendada / Em curso / Concluída / Cancelada)

## Enrollment
- Student self-enrollment in theory classes
- Secretary assigns students to practical classes on creation
- Secretary/admin can add students to existing classes via searchable picker
- Remove student from class (hard delete) — student can be re-added afterwards
- Student picker: checklist with checkboxes (shown on focus), "Selecionar todos" / "Desmarcar todos" respecting capacity
- Only active students/instructors shown in all selects (create class, edit class, add student)
- Capacity check — prevents over-enrollment
- Duplicate prevention — unique constraint on session+student
- Retroactive enrollment: staff can add students to completed classes — auto-marked as ATTENDED with confirmation modal
- Retroactive attendance correction: toggle ATTENDED ↔ NO_SHOW on completed classes with confirmation modal
- Attendance marking: Present / No-show (admin, secretary, instructor) — only for in-progress or completed classes
- Bulk attendance: "Mark all present" button — only for in-progress or completed classes
- Student self-cancellation gated by per-school notice window — cancel button is disabled with explanatory hint when class starts within the window; server enforces the same rule and returns a translatable error
- Universal student access rules (server-enforced on `class.list` + `enrollment.enroll`):
  - Without an active StudentCourse, the student sees no classes and can't enroll
  - Practical classes are filtered to the student's active category only
  - Theory classes are hidden once the student has a PASSED theory exam for their active category
  - Staff (admin/secretary/instructor) bypass these rules so they can enrol students operationally
- Universal exam scheduling rule: practical exam can only be scheduled after the student has a PASSED theory exam for the same course (`exam.schedule` rejects with `exams.theoryNotPassed` otherwise)
- Enrollment status tracking: ENROLLED → ATTENDED / NO_SHOW
- Instructor notes on enrollments: only instructors can write/edit, admin/secretary can view, hidden from students
- Instructor can flag unavailability with confirmation — cancels the class and deletes all enrollments
- Secretary/admin can remove individual students from class detail
- PDF export (attendance sheet) only available for completed classes

## Calendar
- FullCalendar integration (week, day, month, list views)
- Portuguese locale, Monday start, 07:00-22:00 range
- Color-coded events by class type (blue=theory, green=practical)
- Student view: enrolled classes highlighted (vivid) vs available (muted)
- Legend for student calendar
- Click event → class detail dialog with enrollment/attendance actions
- "Ver detalhes" link in calendar popup → class detail page (hidden from students)
- Filters by type and school (admin, secretary)
- Responsive toolbar for mobile

## Analytics (`/analytics`)
- Admin-only "Análises" tab — the strategic counterpart to the operational Painel; lives in the admin section of the sidebar
- Optional school selector at the top (only shown when the tenant has more than one school); all sections re-query with the chosen filter
- **Snapshot row** — four KPI cards over the last 30 days, each with a delta vs. the previous 30-day period: new students, enrolments, attendance rate (in percentage-points), exam pass rate (in percentage-points). Up/down arrows + colour reinforce the sign.
- **Inscrições por mês** — Recharts bar chart, last 6 calendar months including the current (partial) month so "this month vs last" is one glance.
- **Aulas e presença** — Recharts dual-line chart over the last 8 weeks: classes ran (left axis) and attendance rate as a percentage (right axis). Weeks are Monday-start (UTC).
- **Aprovação por categoria** — horizontal bars (recharts vertical-layout `BarChart`) showing pass rate per license category over the last 90 days; bars colour-coded green / amber / destructive by threshold; categories sorted by exam volume so the school's actual mix leads.
- **Carga horária dos instrutores** — table over the last 7 days: instructor name, classes, hours, attendance rate. Instructors with zero classes in the period are excluded.
- Each section streams independently — its own tRPC procedure, skeleton, and fade-in, so a slow query never blocks the rest of the page.
- All data is scoped server-side to `ctx.tenantId`; aggregation is done in JS after a small Prisma read (`findMany` / `count` / `groupBy`) — at tenant scale this is faster to write and just as fast to run as raw SQL.

## Dashboard
- Role-specific home pages
- **Admin/Secretary**: stat cards (scheduled, in progress, students), upcoming classes list with class cards. Each stat card and the list independently load — the active-students card streams in on its own query, the others on the upcoming-classes query.
- **Student (mobile-first)**:
  - Time-of-day greeting (Bom dia / Boa tarde / Boa noite)
  - Next class hero card with countdown ("em 2h 30min")
  - Progress card with stats (scheduled, attended, no-shows) and attendance percentage bar
  - Upcoming enrollments list
  - Available classes with one-tap enroll
- **Instructor (mobile-first)**:
  - Time-of-day greeting
  - Pending-attendance nudge: banner + modal listing classes the instructor taught in the last 14 days that still have unrecorded attendance. Modal auto-opens once per browser session (sessionStorage-gated); banner stays visible until the list is empty. Stacked cards (one per class) with per-student Presente / Faltou toggles, "Marcar todos como presentes" shortcut, and "Fazer mais tarde" to skip a card.
  - Current/next class hero card (pulsing indicator when in progress, gradient change)
  - "All done" state with coffee icon when today's classes are complete
  - Today's progress bar with percentage and mini stats
  - Today's timeline schedule with dot connectors and status indicators — clickable to class detail
  - This week's upcoming classes — clickable to class detail
  - Clickable class cards in classes tab (own classes only)

## Student Profiles (`/students/[id]`)
- Server-side UUID validation + existence check (404 for invalid)
- Profile header with avatar, name, email, phone, school, member since
- Photo placeholder (camera icon for future upload)
- Stat cards: upcoming, attended, no-shows, enrolled
- Theory/practical progress breakdown
- Full enrollment history with color-coded type badges and status — clickable rows link to class detail page

## Instructor Profiles (`/instructors/[id]`)
- Server-side UUID validation + existence check (404 for invalid)
- Profile header with avatar, name, email, phone, school, member since
- Photo placeholder
- Stat cards: upcoming, completed, total, students taught
- Theory/practical class breakdown
- Full class history with enrollment counts and status — clickable rows link to class detail page

## Settings
- Profile section: edit own name
- Change password (via Supabase Auth)
- School info section: edit name, address, phone (admin, secretary)
- Per-school cancellation notice window (hours) — students can't self-cancel within X hours of class start (default 24, range 0-168, configurable by admin/secretary; staff bypass)
- Per-school practical self-enrollment toggle — when off (default), students cannot self-enrol in PRACTICAL classes (only staff can assign them); theory self-enrolment unaffected. Configurable by admin/secretary
- Tenant/group section: edit group name (admin only)

## Notifications
- In-app notification system with bell icon in header (all layouts)
- Unread count badge (red dot with number)
- Notification dropdown with mark as read / mark all as read
- Supabase Realtime listener — new notifications appear instantly without refresh
- Fallback polling every 30 seconds
- i18n-ready: stores translation keys + params, renders in user's locale
- Notification triggers:
  - Class created → notifies instructor
  - Student enrolled by secretary → notifies student
  - Enrollment cancelled by secretary → notifies student
  - Class cancelled → notifies all enrolled students + instructor
  - Instructor marks unavailable → notifies enrolled students + admins/secretaries
  - Students assigned to practical class → notifies students
  - User deactivated → notifies user
- Notifications stored in database (persistent, survives refresh)
- Relative timestamps

## UI/UX
- Convlyx branding with custom logo
- Green/grey/white professional theme (CSS variables, ready for per-tenant accent color)
- Dark mode support (CSS variables defined)
- Inter font
- Icons throughout (lucide-react)
- Split-view auth pages (branding panel + form) on desktop, centered on mobile
- Card + table view toggle (persisted per route in localStorage)
- Card-based list design with hover shadows and transitions
- Responsive design: mobile-first for student/instructor, backoffice for admin/secretary
- Bottom tab navigation for student/instructor
- Sidebar with role-filtered nav items and tenant name for admin/secretary
- Mobile hamburger menu for admin/secretary
- Scrollable dialogs with sticky footer
- Custom date picker (calendar popup via Radix Popover, Portuguese locale)
- Custom time picker (grid of 15-min slots via Radix Popover)
- Searchable student picker with chips (floating dropdown)
- Confirmation dialogs on all destructive actions
- Empty states with icons
- Loading animation (three pulsing dots)
- Toast notifications on all mutations (success + error) — tRPC error keys auto-translated via `useTranslatedError` hook
- URL filter params (shareable, bookmarkable)
- Auto-select when only one option (school, instructor)
- Form validation with Zod schemas
- Custom 404 pages (dashboard with sidebar, root standalone)
- No-tenant landing page for root domain

## i18n
- next-intl with pt-PT locale
- All UI strings from translation file (`messages/pt-PT.json`)
- Zero hardcoded user-facing strings
- Notification messages stored as translation keys with params
- Locale-aware date/time formatting
- Portuguese calendar locale in FullCalendar
- Prepared for multi-locale (just add JSON file)

## API (tRPC)
- Type-safe end-to-end (shared types web ↔ future mobile app)
- Routers: school, class, enrollment, user, notification, course, exam
- Protected procedures with role enforcement
- Zod validation on all inputs
- Supabase JWT auth in tRPC context
- Subdomain-tenant validation in tRPC context
- Auto class status sync on list queries
- Error codes with translatable message keys — client-side `useTranslatedError` hook resolves keys to user-facing messages

## Database
- Supabase PostgreSQL with Prisma ORM
- Tables: tenants, schools, users, class_sessions, enrollments, notifications, student_courses, exams
- Audit columns: updated_at on all tables, created_by/updated_by on class_sessions
- Unique constraint on enrollment (session+student)
- Indexed foreign keys
- Soft delete (user/tenant status: ACTIVE/INACTIVE, class: CANCELLED)
- Seed script with demo data (4 users, one per role)

## PDF Export
- Class attendance sheet: exports class info + student list with attendance status and notes
- Student progress report: exports student info, stats (attendance rate, theory/practical counts), full class history
- Green branded header with Convlyx branding
- Auto-generated filename with class/student name and date
- Download button on class detail page and student profile

## Cron Jobs
- Daily class reminder: runs at 20:00 UTC via Vercel Cron, notifies students and instructors about tomorrow's classes
- Daily exam reminder: same cron — notifies student + accompanying instructor about tomorrow's exams
- Secured via `CRON_SECRET` Bearer token

## Infrastructure
- Next.js 15 (App Router) deployed on Vercel
- Supabase (auth + PostgreSQL database + Realtime)
- Prisma db push via pooler (session mode, port 5432)
- Wildcard subdomain DNS via Cloudflare
- Vercel Analytics + Speed Insights
- Custom favicon and Apple touch icon
- pnpm package manager
- TypeScript strict mode
- ESLint
- Preview deployments on Vercel (dev Supabase for preview env)

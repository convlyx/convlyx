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
- List users with filters (role, school) and search
- Card + table view toggle
- Invite user via email — Supabase sends password setup link (admin, secretary)
- Edit user (name, role, school)
- Deactivate / activate user (admin only) with confirmation dialog
- Role-colored avatars (purple=admin, blue=secretary, green=instructor, primary=student)

## Classes
- List classes with filters (type, school) and search
- Card + table view toggle
- Past / upcoming tabs with URL sync
- Clickable cards → class detail page (admin, secretary)
- Create class — one-off or recurring (by day of week + date range)
- Practical classes: capacity limited to 1-2 students, assign students on creation via searchable picker
- Theory classes: configurable capacity, students self-enroll
- Edit class (instructor, title, capacity, date/time) with confirmation
- Cancel class with confirmation dialog (cascades to all enrollments)
- Class detail page (`/classes/[id]`) for secretary/admin: full class info, student list, add/remove students, attendance, cancel class
- Auto status management: SCHEDULED → IN_PROGRESS → COMPLETED based on time
- Class type badges (Teórica / Prática)
- Status badges (Agendada / Em curso / Concluída / Cancelada)

## Enrollment
- Student self-enrollment in theory classes
- Secretary assigns students to practical classes on creation
- Secretary/admin can add students to existing classes via searchable picker
- Cancel enrollment with confirmation (student cancels own, secretary/admin can cancel any)
- Capacity check — prevents over-enrollment
- Duplicate prevention — unique constraint on session+student
- Re-enrollment after cancellation
- Attendance marking: Present / No-show (admin, secretary, instructor)
- Enrollment status tracking: ENROLLED → ATTENDED / NO_SHOW / CANCELLED
- Instructor can flag unavailability with confirmation — cancels the class and all enrollments
- Secretary/admin can cancel individual student enrollments from class detail

## Calendar
- FullCalendar integration (week, day, month, list views)
- Portuguese locale, Monday start, 07:00-22:00 range
- Color-coded events by class type (blue=theory, green=practical)
- Student view: enrolled classes highlighted (vivid) vs available (muted)
- Legend for student calendar
- Click event → class detail dialog with enrollment/attendance actions
- Filters by type and school (admin, secretary)
- Responsive toolbar for mobile

## Dashboard
- Role-specific home pages
- **Admin/Secretary**: stat cards (scheduled, in progress, students), upcoming classes list with class cards
- **Student (mobile-first)**:
  - Time-of-day greeting (Bom dia / Boa tarde / Boa noite)
  - Next class hero card with countdown ("em 2h 30min")
  - Progress card with stats (scheduled, attended, no-shows) and attendance percentage bar
  - Upcoming enrollments list
  - Available classes with one-tap enroll
- **Instructor (mobile-first)**:
  - Time-of-day greeting
  - Current/next class hero card (pulsing indicator when in progress, gradient change)
  - "All done" state with coffee icon when today's classes are complete
  - Today's progress bar with percentage and mini stats
  - Today's timeline schedule with dot connectors and status indicators
  - This week's upcoming classes

## Student Profiles (`/students/[id]`)
- Server-side UUID validation + existence check (404 for invalid)
- Profile header with avatar, name, email, school, member since
- Photo placeholder (camera icon for future upload)
- Stat cards: upcoming, attended, no-shows, enrolled
- Theory/practical progress breakdown
- Full enrollment history with type badges and status

## Instructor Profiles (`/instructors/[id]`)
- Server-side UUID validation + existence check (404 for invalid)
- Profile header with avatar, name, email, school, member since
- Photo placeholder
- Stat cards: upcoming, completed, total, students taught
- Theory/practical class breakdown
- Full class history with enrollment counts and status

## Settings
- Profile section: edit own name
- Change password (via Supabase Auth)
- School info section: edit name, address, phone (admin, secretary)
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
  - Attendance marked → notifies student
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
- Toast notifications on all mutations (success + error)
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
- Routers: school, class, enrollment, user, notification
- Protected procedures with role enforcement
- Zod validation on all inputs
- Supabase JWT auth in tRPC context
- Subdomain-tenant validation in tRPC context
- Auto class status sync on list queries
- Error codes with translatable message keys

## Database
- Supabase PostgreSQL with Prisma ORM
- Tables: tenants, schools, users, class_sessions, enrollments, notifications
- Audit columns: updated_at on all tables, created_by/updated_by on class_sessions
- Unique constraint on enrollment (session+student)
- Indexed foreign keys
- Soft delete (user/tenant status: ACTIVE/INACTIVE, class: CANCELLED)
- Seed script with demo data (4 users, one per role)

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

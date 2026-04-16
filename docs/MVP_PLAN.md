# Escola de Condução SaaS - MVP Plan

> Driving school management platform for the Portuguese market.
> Multi-tenant SaaS with calendar-based class scheduling.

---

## 1. Product Vision

A platform that helps Portuguese driving schools (escolas de condução) manage theoretical and practical classes, instructor schedules, and student enrollments. Built as a multi-tenant SaaS where each **business group** is a tenant (a group may own multiple schools).

### MVP Scope

| In Scope | Out of Scope (Future) |
|---|---|
| Email/password auth with roles | Social login, SSO |
| Tenant (group) + school hierarchy | Group-wide analytics dashboard |
| Calendar view (classes + availability) | Vehicle/fleet management |
| Theoretical class scheduling + enrollment | Payments & billing |
| Practical class scheduling (1-2 students) | IMT category tracking |
| Secretary/Instructor/Student views | Notifications (email/push) |
| Recurring class creation (weekly patterns) | Mobile app (React Native — near-term, post-MVP) |
| Student self-service booking/canceling | — |
| Subdomain-based tenant routing | DB-per-tenant isolation |

---

## 2. Tech Stack

### Why these choices

The priority is: **right tool for the job > scalability > developer familiarity**. The stack must support a calendar-heavy, multi-tenant app that starts cheap and scales without rewrites.

### Frontend + Backend

| Layer | Choice | Rationale |
|---|---|---|
| **Framework** | **Next.js 15 (App Router)** | Full-stack React framework. Handles SSR, API routes, and subdomain routing via middleware. Huge ecosystem, deploys free on Vercel. |
| **Language** | **TypeScript** | Non-negotiable for a multi-tenant app — type safety prevents entire classes of bugs around tenant isolation. |
| **UI Library** | **shadcn/ui + Tailwind CSS v4** | Copy-paste components (not a dependency), fully customizable. Calendar, data tables, forms — all available. Fast to build with. |
| **Calendar** | **FullCalendar (React)** | Industry standard for scheduling UIs. Supports day/week/month views, drag-and-drop, resource timelines (instructor lanes). Free core, paid scheduler plugin if needed later. |
| **Forms + Validation** | **React Hook Form + Zod** | Zod schemas shared between client and server for end-to-end type-safe validation. |
| **State/Data Fetching** | **TanStack Query (React Query)** | Cache management, optimistic updates for calendar interactions, background refetching. |
| **i18n** | **next-intl** | Lightweight, App Router native, supports ICU message format. JSON translation files per locale. Ships with pt-PT only for now; adding locales later is just adding a JSON file. Works with React Native via `intl-messageformat` (same ICU syntax). |

### Backend + Data

| Layer | Choice | Rationale |
|---|---|---|
| **Database** | **Supabase (PostgreSQL)** | Free tier (500MB, 50K MAU auth). Managed Postgres with built-in auth, Row Level Security, and real-time subscriptions. When MVP is validated, can migrate to self-hosted Postgres or db-per-tenant. |
| **ORM** | **Prisma** | Type-safe queries, excellent migration tooling. When moving to db-per-tenant later, Prisma supports dynamic datasources. |
| **Auth** | **Supabase Auth** | Email/password out of the box, JWT-based, integrates with RLS. Supports custom claims for roles (admin, secretary, instructor, student). |
| **API Layer** | **tRPC v11** | End-to-end type-safe API. Next.js consumes it via server-side caller + React Query integration. React Native app will consume the **same API** via tRPC vanilla client over HTTP. One API, two clients, zero duplication. |

### Infrastructure

| Layer | Choice | Rationale |
|---|---|---|
| **Hosting** | **Vercel (free tier)** | Zero-config Next.js deployment. Supports wildcard subdomains (`*.escolaconduzir.app`). Free tier is generous for MVP. |
| **Domain** | `escolaconduzir.app` or similar | Tenants access via `escola1.escolaconduzir.app`. Wildcard DNS + Next.js middleware resolves tenant. |
| **File Storage** | **Supabase Storage** (if needed) | For profile photos, documents. Free tier included. |
| **CI/CD** | **GitHub Actions** | Lint, type-check, test on PR. Vercel handles deploy. |

### Stack Diagram

```
Browser (escola1.escolaconduzir.app)        React Native App
    │                                        │
    ▼                                        │
┌─────────────────────────────┐              │
│  Vercel (Edge Network)      │              │
│  ┌───────────────────────┐  │              │
│  │ Next.js Middleware     │──── Resolves subdomain → tenant_id
│  │ (subdomain routing)   │  │              │
│  └───────────────────────┘  │              │
│  ┌───────────────────────┐  │              │
│  │ App Router            │  │              │
│  │ - Server Components   │  │              │
│  │ - tRPC React Query    │  │              │
│  └───────────┬───────────┘  │              │
│  ┌───────────▼───────────┐  │              │
│  │ tRPC Router (API)     │◄─┼──────────────┘
│  │ /api/trpc/*           │  │   (same API, HTTP client)
│  └───────────┬───────────┘  │
└──────────────┼──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  Supabase                   │
│  ┌──────────┐ ┌───────────┐ │
│  │ Postgres │ │   Auth    │ │
│  │  + RLS   │ │ (JWT+RBAC)│ │
│  └──────────┘ └───────────┘ │
└─────────────────────────────┘
```

### i18n + Subdomain Routing

The middleware handles both concerns in one pass:
1. Extract subdomain → resolve `tenant_id`
2. Resolve locale (from cookie/header/default) → set `next-intl` locale
3. No path-based locale prefix (no `/pt/dashboard`) — locale is stored in a cookie, subdomain is reserved for tenants

For MVP, locale is always `pt-PT`. When expanding, the user picks their language in settings, it's saved to their profile and set via cookie.

### Why tRPC over REST or Server Actions

Since a **React Native mobile app** is planned for shortly after MVP, the API layer is critical:

- **Server Actions** only work inside Next.js — mobile app can't use them
- **REST** works everywhere but has no type safety — you'd maintain OpenAPI specs or drift
- **tRPC** gives end-to-end TypeScript types shared between web and mobile. The Next.js app uses tRPC's React Query integration (zero HTTP overhead, direct function calls on server). The React Native app calls the same tRPC router over HTTP. **One API, two clients, shared types, zero code duplication.**

---

## 3. Multi-Tenancy Architecture

### MVP: Shared Database with Row-Level Isolation

Every table includes a `tenant_id` column. Supabase RLS policies enforce that users can only access data belonging to their tenant.

```
┌─────────────────────────────────────┐
│           Shared Postgres           │
│                                     │
│  tenant_id = 'grupo-a'             │
│  ├── school: "Escola de Condução Lisboa"  │
│  ├── school: "Escola de Condução Porto"   │
│  └── users, classes, enrollments   │
│                                     │
│  tenant_id = 'grupo-b'             │
│  ├── school: "Escola Conduzir"     │
│  └── users, classes, enrollments   │
└─────────────────────────────────────┘
```

### Subdomain Routing

```
escola-lisboa.escolaconduzir.app
        │
        ▼
Next.js Middleware:
  1. Extract subdomain from Host header
  2. Look up tenant by subdomain (cached)
  3. Inject tenant_id into request headers / cookies
  4. All downstream queries scoped to tenant_id
```

### Future: DB-per-Tenant Migration Path

When scaling beyond MVP:
1. Each tenant gets their own Supabase project (or Postgres instance)
2. A **routing database** maps subdomain → connection string
3. Prisma's dynamic datasource feature connects to the right DB per request
4. No application code changes needed — only the connection resolution layer changes

This is why Prisma was chosen over raw Supabase client for data access.

---

## 4. Data Model (MVP)

> **Key principle**: Classes belong to **Schools**, not to Users. A school offers classes;
> instructors are assigned to teach them; students enroll in them.

```
┌──────────────┐      ┌──────────────┐      ┌──────────────────┐
│   Tenant     │─────<│   School     │─────<│      User        │
│──────────────│      │──────────────│      │──────────────────│
│ id (uuid)    │      │ id (uuid)    │      │ id (uuid)        │
│ name         │      │ tenant_id    │      │ tenant_id        │
│ subdomain    │      │ name         │      │ school_id        │
│ created_at   │      │ address      │      │ email            │
│ status       │      │ phone        │      │ name             │
└──────────────┘      │ created_at   │      │ role (enum)      │
                      └──────┬───────┘      │ created_at       │
                             │              └──────────────────┘
                             │
              ┌──────────────┘
              │
   ┌──────────▼─────────┐
   │ ClassSession       │
   │────────────────────│
   │ id                 │
   │ tenant_id          │
   │ school_id          │
   │ class_type (enum)  │    ClassType: THEORY | PRACTICAL
   │ instructor_id      │
   │ title              │
   │ starts_at (datetime)│
   │ ends_at (datetime)  │
   │ capacity           │    (theory: e.g. 30, practical: 1-2)
   │ status (enum)      │
   │ created_at         │
   └────────┬───────────┘
            │
   ┌────────▼───────────┐
   │ Enrollment         │
   │────────────────────│
   │ id                 │
   │ tenant_id          │
   │ session_id         │    → ClassSession
   │ student_id         │    → User (role=STUDENT)
   │ status (enum)      │
   │ enrolled_at        │
   └────────────────────┘

Enums:
  UserRole: ADMIN | SECRETARY | INSTRUCTOR | STUDENT
  ClassType: THEORY | PRACTICAL
  ClassStatus: SCHEDULED | IN_PROGRESS | COMPLETED | CANCELLED
  EnrollmentStatus: ENROLLED | CANCELLED | ATTENDED | NO_SHOW
```

### Auth ↔ User Table Relationship

Supabase Auth manages its own `auth.users` table (handles login, JWT, password reset). Our Prisma `User` table is a **profile table** that extends it:

```
Supabase auth.users (managed by Supabase)
  │  id, email, password_hash, ...
  │
  └──► User (our Prisma table)
       id = auth.users.id (same UUID)
       tenant_id, school_id, role, name, ...
```

When a user is invited/registered, we: (1) create the Supabase auth account, (2) create the matching `User` row with tenant/school/role info. The JWT from Supabase Auth carries the user ID; our tRPC context looks up the full `User` record (with tenant_id, role) to authorize every request.

### How Recurring Creation Works

Recurrence is a **UI + business logic concept**, not a data model concept. The database only stores individual sessions.

A secretary fills in the create class form:
> "Theory class, instructor João, every Monday 16:00-17:00, from April 21 to May 19, capacity 25"

The tRPC `class.create` procedure receives the recurrence params, loops through the matching dates, and bulk-inserts 4 `ClassSession` rows (one per Monday). Each session is independent — cancelling one doesn't affect the others.

No recurrence tables, no pattern tracking. Simple.

---

## 5. Roles & Permissions

| Action | Admin | Secretary | Instructor | Student |
|---|:---:|:---:|:---:|:---:|
| Manage tenant settings | x | | | |
| Manage schools | x | | | |
| Manage users (CRUD) | x | x | | |
| Create/edit classes | x | x | | |
| Cancel classes | x | x | | |
| View all classes (calendar) | x | x | x (own) | x (own) |
| Enroll student in theory class | x | x | | x (self) |
| Book practical class slot | x | x | | x (self) |
| Cancel enrollment/booking | x | x | | x (self) |
| View student list | x | x | x (own classes) | |
| Mark attendance | x | x | x | |

---

## 6. Key Pages & Views

### Shared
- **Login** — email/password, resolves tenant from subdomain
- **Dashboard** — role-specific home (stats, upcoming classes)

### Secretary / Admin
- **Calendar** — full month/week/day view of all classes (theory + practical), filterable by school, instructor, type
- **Create Class** — unified form: type (theory/practical), school, instructor, capacity (theory: N students, practical: 1-2), schedule mode:
  - **One-off**: pick a specific date + time
  - **Recurring**: pick days of week + time slots + date range (e.g. "Mon 16-17, Tue 18-19 & 19-20, for the next month") → generates individual sessions
- **Students List** — table with search, filter by school, enrollment status
- **Instructors List** — table with availability overview
- **Class Detail** — enrolled students, attendance, status management

### Instructor
- **My Calendar** — personal schedule (theory + practical classes assigned to them)
- **Class Detail** — student list, mark attendance

### Student
- **My Calendar** — enrolled classes + available slots
- **Available Theory Classes** — browse and self-enroll based on schedule
- **Available Practical Slots** — browse open instructor slots and book
- **My Enrollments** — list of current and past enrollments, cancel option

---

## 7. Project Structure

```
saas/
├── docs/                        # Documentation
├── messages/                    # i18n translation files
│   └── pt-PT.json               # Portuguese (default + only locale for MVP)
├── prisma/
│   ├── schema.prisma            # Data model
│   └── migrations/              # DB migrations
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── (auth)/              # Login, register (public)
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/         # Protected routes
│   │   │   ├── layout.tsx       # Sidebar, header, role-based nav
│   │   │   ├── page.tsx         # Dashboard home
│   │   │   ├── calendar/        # Calendar views
│   │   │   ├── classes/         # Class CRUD (unified, type as filter/param)
│   │   │   ├── students/        # Student management
│   │   │   ├── instructors/     # Instructor management
│   │   │   └── settings/        # Tenant/school settings
│   │   ├── api/
│   │   │   ├── trpc/[trpc]/     # tRPC HTTP handler (web + mobile entry point)
│   │   │   └── webhooks/        # REST endpoints for external integrations
│   │   ├── layout.tsx           # Root layout
│   │   └── middleware.ts        # Subdomain → tenant resolution + i18n
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components
│   │   ├── calendar/            # Calendar-specific components
│   │   ├── forms/               # Form components
│   │   └── layout/              # Layout components (sidebar, header)
│   ├── server/
│   │   ├── routers/             # tRPC routers
│   │   │   ├── _app.ts          # Root router (merges all)
│   │   │   ├── auth.ts
│   │   │   ├── school.ts
│   │   │   ├── class.ts         # ClassSession CRUD + recurring generation
│   │   │   ├── enrollment.ts
│   │   │   └── user.ts
│   │   ├── trpc.ts              # tRPC init, context, middleware
│   │   └── db.ts                # Prisma client
│   ├── lib/
│   │   ├── auth.ts              # Auth utilities
│   │   ├── tenant.ts            # Tenant resolution
│   │   ├── trpc.ts              # tRPC React Query client
│   │   ├── i18n.ts              # next-intl config (locales, default locale)
│   │   └── validations/         # Zod schemas (shared web + mobile)
│   ├── hooks/                   # Custom React hooks
│   └── types/                   # Shared TypeScript types
├── public/
├── .env.local
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 8. MVP Roadmap

### Phase 0 — Foundation (Week 1)
- [ ] Project setup (Next.js, TypeScript, Tailwind, shadcn/ui, tRPC, next-intl)
- [ ] Supabase project creation + Prisma setup
- [ ] Database schema + initial migration
- [ ] tRPC router scaffolding (auth, school, class, enrollment, user)
- [ ] next-intl setup (pt-PT default locale, translation file structure)
- [ ] Supabase Auth integration (email/password)
- [ ] Subdomain + i18n middleware (tenant resolution + locale)
- [ ] Base layout (sidebar, header, role-based navigation)
- [ ] Seed script (demo tenant, school, users per role)

### Phase 1 — Core CRUD (Week 2)
- [ ] User management (admin/secretary: invite, list, edit, deactivate)
- [ ] School management (admin: create, edit schools within tenant)
- [ ] Class session CRUD (create one-off or recurring, edit, cancel) — unified for theory + practical
- [ ] Role-based route protection (middleware + component level)

### Phase 2 — Calendar & Scheduling (Week 3)
- [ ] Calendar integration (FullCalendar)
- [ ] Secretary/Admin calendar — all classes, filters
- [ ] Instructor calendar — personal schedule
- [ ] Student calendar — enrolled + available classes
- [ ] Theory class enrollment (student self-service)
- [ ] Practical class booking (student self-service, max 2 students)
- [ ] Cancel enrollment/booking

### Phase 3 — Polish & Validation (Week 4)
- [ ] Dashboard with basic stats (upcoming classes, enrollment counts)
- [ ] Attendance marking (instructor/secretary)
- [ ] Class status management (scheduled → in_progress → completed)
- [ ] Define theme/branding file (colors, typography, spacing, component defaults)
- [ ] Apply theme globally via CSS variables / Tailwind config
- [ ] Empty states, loading states, error handling
- [ ] Responsive design pass (works on tablet for instructors)
- [ ] Verify pt-PT localization works end-to-end (all UI strings use `next-intl`, date formats, etc.)
- [ ] Deploy to Vercel + connect custom domain with wildcard SSL

---

## 9. Key Technical Decisions Log

| Decision | Choice | Alternatives Considered | Rationale |
|---|---|---|---|
| Framework | Next.js 15 (App Router) | Remix, Nuxt, SvelteKit | Best ecosystem for React SSR + Vercel free tier. Middleware handles subdomain routing natively. |
| Database | Supabase (Postgres) | PlanetScale, Neon, Railway | Free tier with built-in auth + RLS. Easy migration to self-hosted Postgres later. |
| ORM | Prisma | Drizzle, Supabase client | Best migration tooling. Dynamic datasources for future db-per-tenant. Type-safe. |
| UI | shadcn/ui + Tailwind | MUI, Ant Design, Chakra | Not a dependency (copy-paste). Full control. Calendar + table components available. |
| Multi-tenancy (MVP) | Shared DB + RLS | Schema-per-tenant | Simplest for MVP. RLS enforced at DB level = defense in depth. |
| Multi-tenancy (Future) | DB-per-tenant | Keep shared | Better isolation, independent scaling, cleaner backups per tenant. Prisma supports this. |
| Auth | Supabase Auth | NextAuth, Clerk, Lucia | Already using Supabase. Free. JWT custom claims for roles. |
| Calendar UI | FullCalendar | react-big-calendar, custom | Most feature-complete. Resource timeline for instructor view. Active maintenance. |
| API Layer | tRPC v11 | REST, GraphQL, Server Actions | Type-safe end-to-end. Same router serves web (direct call) and mobile (HTTP). No API spec to maintain. |
| Hosting | Vercel | Netlify, Railway, Fly.io | Native Next.js support. Wildcard subdomains. Free tier. |
| Mobile (post-MVP) | React Native (Expo) | Flutter, PWA | Shares TypeScript + tRPC types with web. One language across entire stack. |
| i18n | next-intl (pt-PT only for MVP) | next-i18next, react-intl | App Router native, lightweight. All UI strings go through translation from day one. Adding a new locale = adding a JSON file, zero code changes. |
| Default Language | Portuguese (pt-PT) | Start in English | Target market is Portugal. pt-PT from day one avoids retrofit. |

---

## 10. Costs (MVP)

| Service | Tier | Cost |
|---|---|---|
| Vercel | Hobby | Free |
| Supabase | Free | Free |
| Domain (.app) | 1 year | ~€12/year |
| FullCalendar | Standard | Free (MIT) |
| **Total** | | **~€12/year** |

---

## 11. Future Considerations

### Near-term (right after MVP)
- **Mobile app (React Native / Expo)** — consumes the same tRPC API. Student-focused first (view calendar, enroll, cancel). Instructor view second (see schedule, mark attendance). Shares Zod validation schemas and TypeScript types with web via a shared package or monorepo.
- Email/SMS notifications (class reminders, schedule changes)

### Medium-term
- IMT category tracking (A, A1, A2, B, B1, etc.)
- Vehicle/fleet management
- Payment processing (Stripe integration)
- Group-level analytics dashboard
- Instructor availability management (recurring schedules)
- Waiting lists for full classes

### Long-term
- Document management (student contracts, certificates)
- Integration with IMT systems (if API exists)
- DB-per-tenant migration
- Custom branding per tenant

### Monorepo Strategy (when mobile starts)

```
saas/
├── apps/
│   ├── web/          # Next.js (current codebase moves here)
│   └── mobile/       # React Native (Expo)
├── packages/
│   ├── api/          # tRPC router definitions (shared)
│   ├── db/           # Prisma schema + client
│   └── shared/       # Zod schemas, types, constants
└── turbo.json        # Turborepo config
```

Using **Turborepo** to manage the monorepo. The tRPC router and Zod schemas become shared packages that both web and mobile import. This is why tRPC was chosen — it makes this split trivial.

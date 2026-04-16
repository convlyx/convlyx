# CLAUDE.md

## Project Overview

Escola de Condução SaaS — a multi-tenant driving school management platform for the Portuguese market.
See `docs/MVP_PLAN.md` for full architecture, data model, and roadmap.

## Tech Stack

- **Framework**: Next.js 15 (App Router) + TypeScript (strict mode)
- **UI**: shadcn/ui + Tailwind CSS v4
- **API**: tRPC v11 (serves both web and future React Native mobile app)
- **Database**: Supabase (PostgreSQL) + Prisma ORM
- **Auth**: Supabase Auth (email/password, JWT with role claims)
- **Calendar**: FullCalendar (React)
- **i18n**: next-intl (pt-PT only for now)
- **Forms**: React Hook Form + Zod
- **State**: TanStack Query (via tRPC React Query integration)

## Working Principles

- **Best solution, not easiest.** Never take shortcuts that compromise quality, scalability, or correctness.
- **Ask before deciding.** When a decision-making moment comes (architecture, UX flow, library choice, trade-off), ask — do not assume.
- **PT-PT, never PT-BR.** "Escola de condução" not "autoescola", "conduzir" not "dirigir", "carta de condução" not "carteira de motorista". Review all text.

## Architecture

### Multi-Tenancy & Security
- Every table (except Tenant) has a `tenant_id` column. All queries scoped to current tenant — no exceptions.
- Tenant resolved from subdomain via Next.js middleware. tRPC middleware injects `tenantId` automatically so procedures can't forget it.
- Supabase RLS as defense in depth. Prisma for all queries — no raw SQL (if unavoidable, `prisma.$queryRaw` with parameterized inputs).
- All inputs validated via Zod at the tRPC layer. Role checks enforced in tRPC middleware, not in components.
- Never expose internals (stack traces, SQL errors, other tenants' data) to the client.

### Data Model
- Hierarchy: **Tenant → School → ClassSession / User**. Classes belong to Schools, not Users.
- Supabase Auth manages `auth.users`; our Prisma `User` table extends it (same UUID) with tenant/school/role.
- 4 roles: ADMIN, SECRETARY, INSTRUCTOR, STUDENT.
- Soft delete for users/tenants (`status: INACTIVE`). Classes use `CANCELLED` status.

### API Layer
- All business logic in tRPC routers (`src/server/routers/`). **No Server Actions** — API must be consumable by React Native.
- REST endpoints (`src/app/api/webhooks/`) only for external integrations.
- tRPC context always includes `tenantId` and `user`. Use `protectedProcedure` for all authenticated endpoints.
- Typed error codes (`NOT_FOUND`, `FORBIDDEN`, `BAD_REQUEST`) with translatable message keys. Never throw generic errors.

### Database
- Select specific fields — no `SELECT *` without deliberate reason.
- Paginate all lists (cursor-based). Never load unbounded data.
- Transactions for multi-step operations (e.g. auth account + User row).
- Index all foreign keys (`tenant_id`, `school_id`, `instructor_id`, `session_id`).

### i18n
- All user-facing strings use `next-intl` translation keys — never hardcoded text.
- Translation files: `messages/pt-PT.json`. Locale from cookie, not URL path (subdomains are for tenants).
- Dates/times use locale-aware formatters from next-intl.

## Code Conventions

### Structure & Components
- **File paths**: pages in `src/app/`, tRPC routers in `src/server/routers/`, Prisma client in `src/server/db.ts`, Zod schemas in `src/lib/validations/`, shared hooks in `src/hooks/`.
- **Co-locate** page-specific components: `src/app/(dashboard)/calendar/_components/`. Global `src/components/` only for truly shared components.
- **shadcn/ui** lives in `src/components/ui/` — never modify directly; wrap in project components if needed.
- **Server Components by default.** `"use client"` only for interactivity (forms, calendar, modals, hooks). Keep client components small and leaf-level. Never import server code into client components.
- **Theme tokens only** — never hardcode colors/spacing. Use CSS variables via Tailwind. Theme/branding file will be defined later; until then, shadcn/ui defaults.

### Naming
- Files/folders: `kebab-case`. Components: `PascalCase`. tRPC routers: `camelCase`. Zod schemas: `camelCaseSchema` suffix.
- Prisma models: PascalCase (maps to snake_case in Postgres via `@@map`).

### TypeScript & Errors
- Infer types from Prisma and Zod — avoid manual type definitions. Use `RouterOutput`/`RouterInput` for component props.
- Error Boundaries at layout level for unexpected errors. tRPC `onError` callbacks + toasts for expected errors.

### Accessibility
- Semantic HTML (`<button>`, `<nav>`, `<main>`, `<table>`) — no `<div onClick>`. Labels on all inputs. Keyboard accessible interactions.
- Color must not be the only indicator (e.g. status needs text/icon, not just a dot).

### Git & Environment
- Branches: `feature/`, `fix/`, `chore/` + short description. Commits: imperative mood, one concern each.
- Env vars: secrets have no `NEXT_PUBLIC_` prefix. Document all in `.env.example` (committed). Never commit `.env.local`.

## Commands

```bash
npm run dev              # Start dev server
npm run lint             # ESLint
npm run type-check       # TypeScript check
npm run build            # Production build
npx prisma migrate dev   # Run migrations
npx prisma generate      # Regenerate client
npx prisma studio        # DB browser
npx prisma db seed       # Seed data
```

## Common Patterns

### New tRPC router
1. Create file in `src/server/routers/`, define procedures with `protectedProcedure`
2. Add Zod input schemas in `src/lib/validations/`
3. Merge into root router in `src/server/routers/_app.ts`

### New page
1. Create route in `src/app/(dashboard)/`
2. `useTranslations()` for all strings, add keys to `messages/pt-PT.json`
3. Fetch data via `trpc.router.procedure.useQuery()`

### Recurring class creation
- Business logic only — no database tables for recurrence
- `class.create` accepts optional recurrence params, bulk-inserts individual `ClassSession` rows
- Each session is independent after creation

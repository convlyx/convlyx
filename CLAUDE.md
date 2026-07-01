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
- Every table (except `Tenant` and `AuditLog`) has a `tenant_id` column. All queries scoped to current tenant — no exceptions.
- Tenant resolved from subdomain via Next.js middleware. tRPC middleware injects `tenantId` automatically so procedures can't forget it.
- **Defense in depth via Prisma extension**, not RLS. `protectedProcedure` wraps `ctx.db` with a tenant-scope client (`src/server/lib/tenant-scope.ts`) that auto-merges `tenantId` into every query against a tenant-scoped model — even reads, writes, and creates. Cross-tenant `tenantId` values in calls are always overridden by the request's tenant. Forbidden: `findUnique` / `findUniqueOrThrow` on tenant-scoped models (use `findFirst` with `tenantId`; the extension throws a clear error otherwise). The raw `db` import is still available for cross-tenant code paths: `createTRPCContext` (initial auth lookup), platform-admin REST routes, and crons.
- Prisma for all queries — no raw SQL (if unavoidable, `prisma.$queryRaw` with parameterized inputs; raw SQL bypasses the tenant-scope extension and must filter explicitly).
- All inputs validated via Zod at the tRPC layer. Role checks enforced in tRPC middleware, not in components.
- Never expose internals (stack traces, SQL errors, other tenants' data) to the client.
- **Supabase RLS** is not currently used as defense-in-depth — Prisma connects via the Postgres superuser role which bypasses RLS. The tenant-scope extension above is the equivalent layer at the ORM level. If you ever wire the Supabase JS client to read app data from the browser, you must add proper RLS policies on those tables first (currently only used for auth + push subscriptions, which are tenant-isolated at the application layer).

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
- All tables must have `updated_at` (auto-managed by Prisma `@updatedAt`). Mutation-heavy tables (`ClassSession`) also have `created_by` and `updated_by`.
- Use unique constraints to prevent duplicates (e.g. `@@unique([session_id, student_id])` on Enrollment).

### GDPR Awareness
- EU market — GDPR applies. All user data must be traceable via FK chains (User → Enrollments, ClassSessions, etc.) so data export and deletion are possible.
- Soft delete covers most cases; a hard-delete path for GDPR requests will be added post-MVP.
- Keep side effects in tRPC procedures separable (e.g. `createEnrollment` does the insert, then triggers notifications) so future event-driven patterns (emails, audit logs, webhooks) can hook in without rewriting business logic.

### i18n
- All user-facing strings use `next-intl` translation keys — never hardcoded text.
- Translation files: `messages/pt-PT.json`. Locale from cookie, not URL path (subdomains are for tenants).
- Dates/times use locale-aware formatters from next-intl.

### Performance
See `docs/decisions/2026-06-01-performance-optimization.md` for full context.
- **Region:** Vercel functions run in Dublin (`dub1`) to co-locate with Supabase (`eu-west-1`). Set globally in Vercel project settings **and** pinned via `export const preferredRegion = "dub1"` in every API route handler + the root layout — keep new API routes pinned.
- **DB connections:** `DATABASE_URL` = Supabase transaction pooler (`6543`, `?pgbouncer=true`) for the app (`src/server/db.ts`, pool `max: 5`); `DIRECT_URL` = session pooler (`5432`) for migrations (`prisma.config.ts` reads it). Never point `DATABASE_URL` at `6543` without also setting `DIRECT_URL`, or migrations break.
- **SSR-prefetch list pages:** the Server Component prefetches the page's main query so the HTML ships with data (no skeleton flash, no extra client round-trip). Use `getSsrHelpers()` + `dehydrateSsr()` from `src/server/ssr.ts` inside `<HydrationBoundary>`. The prefetch input **must exactly match** the client `useQuery` input (including URL-param defaults) or the query key won't match and the client refetches. For date-range queries, compute the range once on the server in Portugal time and pass it to the client as a prop (see `src/lib/dashboard-ranges.ts` + the dashboard panels) so both sides share the identical input — never let server and client each call `new Date()`. `/calendar` is the only page not yet prefetched (its range follows the user-driven viewport).
- **Heavy/click-only libs are lazy-loaded** via dynamic `import()` (jspdf in `src/lib/pdf-export.ts`, posthog-js in `src/lib/posthog.ts`) to keep them out of route bundles. Follow this for any large dependency only used behind an interaction.

## Code Conventions

### Structure & Components
- **File paths**: pages in `src/app/`, tRPC routers in `src/server/routers/`, Prisma client in `src/server/db.ts`, Zod schemas in `src/lib/validations/`, shared hooks in `src/hooks/`.
- **Co-locate** page-specific components: `src/app/(dashboard)/calendar/_components/`. Global `src/components/` only for truly shared components.
- **UI primitives** live in `src/components/ui/` and are built on **`@base-ui/react`** (not raw shadcn) — never modify directly; wrap in project components if needed. **One sanctioned exception:** `ui/radix-select.tsx` (the only Select) is built on `@radix-ui/react-select` and is the canonical select — do not add a second select implementation. The shared `Card` (`ui/card.tsx`) is the standard surface wrapper.
- **Server Components by default.** `"use client"` only for interactivity (forms, calendar, modals, hooks). Keep client components small and leaf-level. Never import server code into client components.
- **Theme tokens only** — never hardcode colors/spacing. Use CSS variables via Tailwind. Status colors use the semantic tokens `--success` / `--warning` / `--info` (e.g. `text-success`, `bg-warning`) — never raw palette literals like `text-emerald-600`. **Card radius standard: `rounded-xl`** (the `Card` primitive's default) for all card/section surfaces; reserve `rounded-2xl`+ for hero banners, icon tiles, and pills.

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
npm run dev                                       # Start dev server
npm run lint                                      # ESLint
npm run type-check                                # TypeScript check
npm run build                                     # Production build (`prisma generate && next build` — migrate deploy kept out deliberately; see "PROD DB ROUTING" note below)
npm run db:migrate -- --name <descriptive_name>   # Create + apply a new migration locally
npm run db:migrate:status                         # See applied vs. pending migrations (dev)
npm run db:migrate:status:prod                    # Same against prod DB (trustworthy — uses DIRECT_URL/5432)
npm run db:migrate:deploy:prod                    # Apply pending migrations to prod (standard path — uses DIRECT_URL/5432)
npm run db:generate                               # Regenerate Prisma client
npm run db:studio                                 # DB browser
npm run db:seed                                   # Seed data
```

## Database Migrations

**Use `prisma migrate`, never `prisma db push`.** The `db:push` scripts have been removed from `package.json` on purpose.

Workflow for any schema change:
1. Edit `prisma/schema.prisma`
2. Run `npm run db:migrate -- --name <descriptive_name>` — generates a numbered folder under `prisma/migrations/` (a reviewable `.sql` file) and applies it to the dev DB
3. Commit the schema change + the new migration folder together in the same PR — reviewers see the SQL diff
4. **Apply to prod with `npm run db:migrate:deploy:prod`** — runs `prisma migrate deploy` via `DIRECT_URL` (session pooler, 5432), which reaches the same physical instance the live app uses (see "PROD DB ROUTING" below). This both applies the migration and records it in `_prisma_migrations`. No hand-pasting into the dashboard, no manual `_prisma_migrations` insert.

The repo is baselined to `prisma/migrations/0_init/migration.sql` representing the schema at the time of the switch from `db push` to migrate. Both dev and prod DBs already have it marked applied.

If migration state diverges (e.g. someone runs raw SQL on prod): `npm run db:migrate:resolve:prod -- --applied <name>` (or `--rolled-back <name>`) to reconcile — this uses `DIRECT_URL`/5432, the same trustworthy path as deploy.

### PROD DB ROUTING (investigated & resolved 2026-07-01)

Full write-up: `docs/decisions/2026-06-24-prod-db-routing-investigation.md`.

**Diagnosis:** the live app (Vercel), the `DIRECT_URL`/5432 migration path, and the Supabase dashboard all read/write the **same** physical Postgres instance. Migrations applied via `DIRECT_URL` reach exactly the DB the app uses. The earlier "migrations land on a different physical DB" belief was a **local-machine artifact**: Supabase's **6543 transaction pooler routes the same connection string to different backends by network origin** — from Vercel (Dublin, co-located) it reaches the live primary; from a local machine it reached a leftover "ghost" instance from an Apr-2026 compute change. The original marker-table test was run locally via 6543 (→ ghost) and compared to the dashboard (→ primary), producing the false "two databases" conclusion.

**Rules that follow:**
- `npm run db:migrate:deploy:prod` / `db:migrate:status:prod` / `db:migrate:resolve:prod` **are trustworthy** — they use `DIRECT_URL`/5432 (via `prisma.config.ts`), which consistently reaches the live instance. Prod migration = this command.
- **Never run prod scripts locally via the 6543 pooler (`DATABASE_URL`).** From a local machine the 6543 pooler may hit the ghost instance. Any local prod tooling (one-off scripts, `db:seed:prod`, etc.) must use `DIRECT_URL`/5432. Prisma migrate commands already do.
- `prisma migrate deploy` is still **kept out of the `build` script** — not for the routing myth, but as deliberate separation (a failed migration shouldn't be tangled up with a frontend build). Re-enabling it as a dedicated CI step on `main` is a future option (workstream A in `docs/superpowers/specs/2026-06-24-pre-launch-hardening-and-cross-tenant-identity-design.md`).
- Optional hygiene: the ghost instance is harmless to production (Vercel never routes to it), but a Supabase support ticket to decommission it would remove the local-6543 footgun entirely.

Preview deployments still have a separate unresolved issue: their `*.vercel.app` URLs don't match the `*.convlyx.com` tenant subdomain pattern, so tenant resolution doesn't work for preview testing. Migrations *are* applied (against the dev/preview Supabase), but exercising the running app against a tenant requires either local testing with `demo.localhost:3000` or setting up a wildcard preview domain — separate from the migration workflow.

## Common Patterns

### New tRPC router
1. Create file in `src/server/routers/`, define procedures with `protectedProcedure`
2. Add Zod input schemas in `src/lib/validations/`
3. Merge into root router in `src/server/routers/_app.ts`

### New page
1. Create route in `src/app/(dashboard)/`
2. `useTranslations()` for all strings, add keys to `messages/pt-PT.json`
3. Fetch data via `trpc.router.procedure.useQuery()`
4. For list/detail pages, SSR-prefetch the main query in the Server Component (`getSsrHelpers()` + `dehydrateSsr()` + `<HydrationBoundary>`) — mirror the client's exact query input. See the Performance section.

### Recurring class creation
- Business logic only — no database tables for recurrence
- `class.create` accepts optional recurrence params, bulk-inserts individual `ClassSession` rows
- Each session is independent after creation

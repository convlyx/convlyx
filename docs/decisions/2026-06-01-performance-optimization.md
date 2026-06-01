# Performance Optimization — Decisions

**Date:** 2026-06-01
**Context:** The app felt sluggish. A code/architecture audit + objective measurement (Vercel `x-vercel-id` region, Speed Insights TTFB, Supabase Query Performance, `curl` timing breakdowns) traced it primarily to network/region, then cold starts, then frontend waterfalls — *not* to slow SQL (the DB showed 100% cache hit and app queries weren't even in the top consumers).

## How to measure (use before/after on any perf change)

- **Vercel region of a request:** `curl -sI <url> | grep x-vercel-id` → format is `<edge-ingress>::<compute-region>::<id>`. The **second** segment is where the function ran. Want `dub1`.
- **Server vs network split:** `curl -s -o /dev/null -w 'tls:%{time_appconnect} ttfb:%{time_starttransfer} total:%{time_total}\n' <url>`. `ttfb - tls` ≈ server+DB work. Run several times — first hit is a cold start.
- **Real users:** Vercel Speed Insights (TTFB/LCP/INP).
- **DB:** Supabase → Query Performance (`pg_stat_statements`) + `EXPLAIN ANALYZE`.
- Note: test from the **target market (Portugal)**, not a US-hosted tool — Cloudflare/edge ingress region skews the numbers otherwise.

## Decisions

### D1 — Pin Vercel functions to Dublin (`dub1`)

Functions defaulted to `iad1` (US East) while Supabase is `eu-west-1` (Ireland), so every DB round-trip crossed the Atlantic (~80–100ms each). A single tRPC request stacks several (auth + user lookup + query), which dominated TTFB.

Fix: set **Function Region = Dublin (dub1)** in Vercel project settings (global), **and** pin `export const preferredRegion = "dub1"` in every API route handler + the root layout as a version-controlled backstop. Result: warm `/api/tenant` dropped ~1000ms → ~150ms (from Portugal).

The leading `iad1` still seen in `x-vercel-id` is the Cloudflare→Vercel ingress hop, not where code runs — left as-is.

### D2 — Connection pooling: transaction pooler for the app, session pooler for migrations

Runtime was on a direct/session connection (`5432`) with `pg` pool `max: 1`, which serializes concurrent queries per Fluid Compute instance.

- **`DATABASE_URL`** → Supabase **transaction pooler** (`6543`, `?pgbouncer=true`) — recommended for serverless. Used by `src/server/db.ts`; pool `max` raised to `5`. Transaction mode has no prepared statements, but the `pg` driver uses unnamed statements, so `@prisma/adapter-pg` is safe.
- **`DIRECT_URL`** → **session pooler** (`5432`) — used by `prisma migrate`. `prisma.config.ts` now reads `process.env.DIRECT_URL ?? process.env.DATABASE_URL` (the fallback keeps CI, which has only a plain Postgres `DATABASE_URL`, working). **Whenever `DATABASE_URL` is the 6543 pooler, `DIRECT_URL` must be set**, or migrations would run through the transaction pooler and fail.

Both URLs documented in `.env.example` / `.env.prod.example`.

### D3 — Cold starts are a Hobby-plan ceiling

After D1/D2, warm requests are ~150ms but cold starts remain ~600–850ms (Fluid Compute is on; the Hobby plan has no provisioned concurrency and reaps idle instances). Pooling/region don't fix function-boot time. Accepted for now. Optional mitigation logged for later: an external uptime pinger every ~5 min to keep one instance warm, or upgrade to Pro.

### D4 — Bundle: lazy-load heavy, click-only libraries

- **jspdf + jspdf-autotable (~300KB)** were imported at module top in `src/lib/pdf-export.ts`, so they loaded on every student/class detail page. Now lazy-loaded via `await import()` inside the export functions (they run on a button click). Type-only `import type` keeps the `jsPDF` type for helper signatures.
- **posthog-js (~75KB gzip)** loaded on every dashboard page. Now lazy-loaded via dynamic `import()` in `src/lib/posthog.ts`, kicked off on `requestIdleCallback`. Calls made before it loads are queued and flushed. Public API (`track`, `identifyUser`, `capturePageview`, `resetAnalytics`) unchanged; the raw `posthog` export was replaced with `capturePageview`.
- **recharts / FullCalendar** are route-scoped (`/analytics`, `/calendar` only), so they don't hit the initial bundle — left as-is.

### D5 — Drop the notification poll

`NotificationBell` polled `unreadCount` every 30s, redundant with the existing Supabase Realtime subscription that already invalidates on new notifications. Removed the `refetchInterval`; kept `refetchOnWindowFocus: true` as a safety net.

### D6 — SSR-prefetch + hydration for list pages

Pages shipped an empty shell, hydrated, then fetched — a skeleton flash + extra client round-trip on every load. Now the Server Component prefetches the page's main query and ships the data in the HTML.

- `src/server/ssr.ts`: `getSsrHelpers()` builds tRPC `createServerSideHelpers` from the **cached dashboard user** (no extra auth/DB round-trip), and `dehydrateSsr()` dehydrates with `superjson.serialize`.
- `src/lib/trpc-provider.tsx`: the client `QueryClient` must have matching `dehydrate.serializeData = superjson.serialize` and `hydrate.deserializeData = superjson.deserialize` — without this, superjson data fails to rehydrate and the client refetches anyway (this was the bug that made the first attempt silently no-op).
- Pages prefetch with **the exact same input the client's `useQuery` derives** (including URL-param defaults), or the query key won't match. `prefetch` never throws, so a miss degrades gracefully to the old client-fetch behavior.
- **Rolled out:** `/students`, `/instructors`, `/staff`, `/enrollments`, `/schools`.
- **Skipped:** `/` (home) and `/calendar` derive query inputs from `new Date()` client-side; the server's "now" won't byte-match the client's, so the key would miss and refetch regardless. Would need deterministic (date-only) range boundaries first — logged as follow-up.
- Side fix: `CreateUserDialog`/`EditUserDialog` now fetch `school.list` only when open (`enabled: open`), removing that call from every list page.

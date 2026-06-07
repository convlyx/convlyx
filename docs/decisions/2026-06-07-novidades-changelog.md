# Novidades (What's New) — Design & Decisions

**Date:** 2026-06-07
**Context:** Add a non-invasive "Novidades" surface so staff discover new features inside the app, and a public blog on the marketing site for the same content (SEO + a visible feature history). Mirrors the notification-bell popover in look, but is fundamentally different content: **global editorial posts authored by us**, not per-tenant system-generated events.

## Decisions

### D1 — Content lives in Markdown files, not the database
Posts are Markdown files in `content/novidades/`, named `YYYY-MM-DD-slug.md`, with frontmatter:

```yaml
---
title: "Proteção contra marcações duplicadas"
date: 2026-06-07
audience: [ADMIN, SECRETARY, INSTRUCTOR]   # optional → defaults to all staff roles
public: true                                # optional → defaults true (also show on blog)
summary: "Uma frase de resumo."             # optional → falls back to first paragraph
cover: /novidades/double-booking.png        # optional hero image
---
Markdown body…
```

Rationale: one source of truth for both the in-app popover and the public blog; versioned with the code; trivially backdated; statically generated for SEO; no tenant-scoping concerns (content is global, identical for every tenant). A DB table would break the "everything is tenant-scoped" model and add another manual prod migration for no benefit at this stage.

A server-only module `src/lib/novidades.ts` parses all files (frontmatter via `gray-matter`), exposes `getAllPosts()` / `getPostBySlug(slug)` / `getPostsForRole(role)`, sorted newest-first. Bodies render with `react-markdown` + `remark-gfm`.

> **`no-hardcoded-strings` exception:** post *content* is editorial data in `.md` files, not UI chrome. All surrounding UI ("Novidades", "Ver todas", empty state, dates) uses `next-intl` keys as normal.

### D2 — Audience is staff-only for MVP; students deferred
Default `audience` is `[ADMIN, SECRETARY, INSTRUCTOR]`. Students are excluded: Convlyx is primarily a management platform, most posts are back-office changes, and staff are one coherent audience who understand both BO and app — so a single post can describe both sides without splitting. The `audience` frontmatter field already supports adding `STUDENT` later (surface the icon in the mobile shell for students) with no rework.

### D3 — Per-user state is a single timestamp, no join table
One nullable column on `User`: `novidades_seen_at TIMESTAMP`. The unread badge counts posts whose publish instant `> novidades_seen_at` **and** whose `audience` includes the viewer's role. Opening the popover marks everything seen (`novidades_seen_at = now()`), clearing the badge. No per-post read rows — simpler, and "what's new since you last looked" is exactly the right semantic for a changelog.

Each post's publish instant comes from its frontmatter `date`, which accepts an **optional time** (`YYYY-MM-DD HH:mm`, interpreted in the server zone / UTC in prod). Without a time it falls back to that day's UTC midnight. The optional time exists so a post published *later* on a day a user already opened the panel still registers as unread — date-only granularity would silently miss those (`day-00:00 < seenAt-mid-day`). The display `date` stays day-only.

### D4 — In-app surface mirrors the notification bell
A `NovidadesButton` client component (Radix Popover, `Newspaper` icon) sits left of the bell in both `header.tsx` (ADMIN/SECRETARY desktop) and `mobile-layout.tsx` (INSTRUCTOR mobile shell). It renders `null` for `STUDENT`. Non-invasive: no auto-popup, no modal — just a subtle unread badge identical to the bell's.

- Popover: recent posts (title · relative date · summary · unread dot) + footer "Ver todas as novidades".
- A post → detail page `/novidades/[slug]`; footer → index `/novidades`. Full Markdown renders there.
- tRPC `novidades` router: `feed` (role-filtered post metadata + unread count) and `markSeen` (stamps the timestamp). No realtime — content only changes on deploy.

### D5 — One set of `/novidades` routes serves both surfaces (collision fix)
**Discovered during build:** a dashboard route `(dashboard)/novidades` and a top-level `/novidades` both resolve to the path `/novidades`, which Next.js refuses to compile (two pages, one path). Rather than invent a second URL, **a single top-level, public, statically-generated route serves everyone**: `src/app/novidades/page.tsx` (index) + `src/app/novidades/[slug]/page.tsx` (post). Marketing-styled, SEO metadata + `generateStaticParams`, linked from the landing footer. The in-app popover (D4) links into these same pages. Trade-off: a logged-in staff member reading a post leaves the dashboard chrome for a clean article page — acceptable, and common for "what's new" changelogs.

- **Middleware:** `/novidades` is added to the root-domain allowlist (otherwise apex 404s it). On tenant subdomains it stays behind auth (staff are logged in, so the popover links work).

### D5b — All posts are public for MVP (`public` field deferred)
With a single shared route, an "in-app-only" post would have no page to open. So for MVP **every post is public** — it appears on `/novidades` and is readable by anyone with the link. The `audience` field still gates the *in-app popover/badge* (who gets nudged), but not page visibility. A future `public: false` (in-app-only, rendered inline in the popover) is deferred; `audience` remains the live targeting mechanism.

### D6 — File loading at runtime
The tRPC `feed` reads the content dir at runtime, so `content/` is pinned into the serverless bundle via `outputFileTracingIncludes` in `next.config.ts`. Blog pages are static (build-time) and unaffected.

## Migration note
`novidades_seen_at` is one more migration requiring the **manual prod apply** (per the known prod-migration issue in CLAUDE.md). It queues behind the per-school-timezone migration already pending prod.

## Scope — explicitly out of MVP
- **Backdated posts from git history** — a content task done after the pipeline works, not engineering scope.
- **Student-facing Novidades** — deferred (D2); no rework needed to add.
- **DB-backed admin editor** — deferred; revisit if non-deploy publishing is ever needed.

## New dependencies
`gray-matter` (frontmatter), `react-markdown` + `remark-gfm` (rendering). All content-only, server-side.

# Admin Panel — Internal Tools & Insights (design spec)

**Date:** 2026-07-13
**Status:** Draft for review
**Scope:** Turn `admin.convlyx.com` (`src/app/platform-admin/`) from a thin create-only MVP into a rich internal operator console: per-account insight pages, a portfolio overview for decision-making, operational actions, and gated support tooling.
**Audience:** Convlyx team only. Internal-use, operator-facing. **Not** customer-facing.

---

## 1. Goals

1. **See how each school is doing at a glance** — a dedicated page per tenant/school with usage, growth, activity and outcome metrics, presented visually.
2. **Make portfolio decisions** — one view across all tenants/schools to spot who's growing, who's stalling, and who's *going quiet* (at-risk), sortable/searchable.
3. **Act faster** — suspend/reactivate, edit settings, manage admins from the panel instead of the DB console.
4. **Support & troubleshoot** — look up a school fast, inspect config + recent activity, and (deliberately, audited) drill into an individual record or view-as a user.

Design bias: **visual and insightful** — charts, sparklines, health badges, timelines, funnels. Aggregate-first.

---

## 2. Constraints & non-goals (what's *doable*)

These are hard facts about the current data model (`prisma/schema.prisma`, 12 models) and shape everything below.

- **No billing/revenue data exists.** No plan, MRR, invoice, Stripe, or payment fields anywhere. **Non-goal:** revenue, ARPU, MRR, revenue-churn. If monetization data is added later (external Stripe or new models), a "Billing" panel becomes a future sub-project. Where a "plan/tier" would naturally appear, we show account age + activity instead.
- **No historical activity/session data.** There is no login/last-seen/session tracking today. We add a **lightweight heartbeat** (§4.3) that records activity *from ship date forward*. **Non-goal:** back-filled engagement history. WAU/last-active charts start accumulating the day the heartbeat ships; the panel will state this honestly ("tracking since <date>").
- **GDPR posture.** Schools are data controllers; Convlyx is the processor. **Aggregates (counts, rates, trends) are shown freely.** Any view of an *individual end-user's* personal data, or any *view-as/impersonation*, is a deliberate action written to `AuditLog` (who, when, which tenant, why). This is a first-class design constraint, not an afterthought — see §7 and §8.1.
- **`AuditLog` is operator-only and not tenant-scoped** (no `tenantId` relation). Tenant linkage is via `targetType`+`targetId`. All new operator reads/writes that touch PII or mutate state append to it.
- **Internal tool = non-i18n.** Consistent with the existing `platform-admin` area, operator UI uses hardcoded Portuguese (team language), **not** `messages/pt-PT.json`. The product-wide "no hardcoded strings" rule governs customer-facing UI only. (Reversible later if the team wants.)

---

## 3. Metrics catalog (what we can compute, and from where)

Every metric below is derivable from existing fields (plus the new `lastSeenAt`). This is the source-of-truth mapping so implementation never guesses.

### Portfolio-level (across all tenants)
| Metric | Source |
|---|---|
| Tenants total / active / inactive | `Tenant.status` |
| Schools total | `School` count |
| Active members (all roles) | `Membership.status = ACTIVE` |
| New tenants / schools over time | `Tenant.createdAt`, `School.createdAt` |
| Weekly-active users (platform) | `Membership.lastSeenAt` within 7d *(new)* |
| Classes created last 30d | `ClassSession.createdAt` |
| Enrollments last 30d | `Enrollment.enrolledAt` (composite index exists) |
| Platform exam pass rate | `Exam.result` (PASSED / total decided) |
| At-risk school count | at-risk heuristic (§8.2) |

### Per tenant / school
| Metric | Source |
|---|---|
| Account age | `createdAt` |
| Status | `Tenant.status` |
| Members by role & status | `Membership.role` + `.status` grouped |
| Active students / instructors | `Membership` where role=STUDENT/INSTRUCTOR, status=ACTIVE |
| Last active + WAU | `Membership.lastSeenAt` (max + count ≤7d) *(new)*; Supabase `last_sign_in_at` as secondary |
| Classes scheduled / completed / cancelled | `ClassSession.status` |
| Classes over time | `ClassSession.createdAt` / `startsAt` |
| Theory vs practical split | `ClassSession.classType` |
| Class utilization | `Enrollment` count vs `ClassSession.capacity` |
| Enrollments over time | `Enrollment.enrolledAt` (indexed) |
| Enrollment funnel | `Enrollment.status` (ENROLLED → ATTENDED / NO_SHOW / CANCELLED) |
| Check-in rate | `Enrollment.checkedInAt` not null / attended |
| Course completion rate + time-to-complete | `StudentCourse.status`, `completedAt − startedAt` |
| Exam pass rate by type & category | `Exam.result`, `Exam.type`, `StudentCourse.category` |
| Notification volume by type | `Notification.type`, `.createdAt` |
| Consent coverage (DPA / terms) | `ConsentRecord.type` |
| Activity timeline | union of `ClassSession.createdAt/updatedAt` (staff writes, with `createdById`), `Enrollment.checkedInAt` (student presence), `Exam.scheduledAt`, `Membership.lastSeenAt` |

**Not computable** (documented so nobody tries): revenue/MRR, true session duration, DAU history before heartbeat ships, per-user last-login before heartbeat (Supabase gives current `last_sign_in_at` only, not history).

---

## 4. Architecture foundation (Sub-project 1, phase 0)

Shared plumbing every later phase builds on. Built first.

### 4.1 `requirePlatformAdmin()` — one allowlist helper
The `PLATFORM_ADMIN_EMAILS` check is currently duplicated in 4 files (`platform-admin/layout.tsx` + 3 REST routes), each re-parsing the env var. Extract one helper:

- `src/server/lib/platform-admin.ts` → `parsePlatformAdminEmails()`, `isPlatformAdmin(email)`, `requirePlatformAdmin(supabaseUser)` (throws / redirects as appropriate).
- Refactor the 4 existing call-sites onto it. No behaviour change; removes drift risk.

### 4.2 `adminProcedure` + `admin` tRPC router
Admin logic today is REST-only (no Zod ergonomics, no shared context). Add a platform-admin tRPC surface:

- **`adminProcedure`** (in `src/server/trpc.ts`): like `protectedProcedure` but (a) authorizes via `requirePlatformAdmin` on the Supabase user, (b) exposes **raw `db`** (cross-tenant — `Tenant`/`AuditLog` are already unscoped; other models are read cross-tenant here deliberately), (c) provides an `audit()` binding pre-filled with the operator email. It is the single audited choke point for all cross-tenant operator access.
- **`admin` router** (`src/server/routers/admin/`), split by concern so no file grows unwieldy:
  - `admin/portfolio.ts` — overview list + portfolio KPIs/trends
  - `admin/account.ts` — per-tenant/school detail queries
  - `admin/ops.ts` — mutations (suspend, edit, manage admins) — sub-project 2
  - `admin/support.ts` — gated PII lookup + impersonation issue — sub-project 3
  - merged into `_app.ts` under `admin`.
- The three existing REST routes (`api/platform-admin/{tenants,schools,admins}`) **stay** (they touch Supabase service-role auth for user creation and are called from dialogs); over time their pure-DB parts can migrate to `ops.ts`, but that's not required for phase 0. CSRF + `dub1` pinning conventions preserved.

### 4.3 Activity heartbeat (`lastSeenAt`)
- **Schema:** add `lastSeenAt DateTime?` to `Membership` (→ `last_seen_at`), plus `@@index([tenantId, lastSeenAt])` for per-school WAU range scans. Migration via `prisma migrate` (dev) then `db:migrate:deploy:prod`.
- **Write path:** membership is already resolved once per request (commit `46e0391` resolves it per request, not per procedure). On any authenticated request, if `lastSeenAt` is null or older than **60 min**, fire a fire-and-forget update. Throttled so it adds ≤1 write/hour/active-user — negligible load, no request-latency cost (not awaited).
- **Read path:** WAU = `count(Membership where lastSeenAt ≥ now−7d)`; last-active = `max(lastSeenAt)` per school. Secondary signal: Supabase Auth `last_sign_in_at` (read via service-role admin client, cross-tenant, in `admin/account.ts`) for a "last login" line — clearly labelled as auth-level.
- **Honesty:** UI shows "Activity tracked since <heartbeat ship date>" wherever WAU/last-active appears, so early-period gaps aren't misread as inactivity.

### 4.4 Audited reads
`adminProcedure`'s `audit()` is called for: any individual-PII read (`support.getStudent`), impersonation issue, and every mutation. New audit `action` verbs introduced are enumerated per phase below. Aggregate reads are **not** audited (no PII).

---

## 5. Sub-project 1 — Insights core

The centerpiece. Foundation (§4) + two pages. Reuses the tenant analytics house style: `ChartCard`, `StatCard`, `SnapshotRow`/`DeltaBadge`, Recharts (`h-64`, `var(--*)` colors, `isAnimationActive={false}`, `aria-hidden` chart paired with `SrDataTable`), SSR-prefetch (`getSsrHelpers` + `dehydrateSsr` + `HydrationBoundary`), URL-synced filters via `use-url-param`.

### 5.1 Portfolio overview — `admin.convlyx.com/` (replaces current `platform-admin/page.tsx`)

Purpose: the decision surface. Answer "where should my attention go?" in one screen.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Convlyx Admin · Visão geral                       [+ Tenant] [+ Escola]│
├──────────────────────────────────────────────────────────────────────┤
│  KPI ROW (SnapshotRow, deltas vs prior period)                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                       │
│  │ Escolas │ │ Utiliz. │ │ Aulas   │ │ Em risco│                       │
│  │  24  ▲2 │ │ ativos  │ │ 30d     │ │  3   ▲1 │  ← at-risk in --warning│
│  │         │ │ 312 ▲18 │ │ 1.2k ▼4%│ │         │                       │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘                       │
│                                                                        │
│  TRENDS (2 ChartCards)                                                 │
│  ┌───────────────────────────┐ ┌───────────────────────────┐          │
│  │ Novas escolas / mês (bar) │ │ Aulas & inscrições 90d(line)│         │
│  └───────────────────────────┘ └───────────────────────────┘          │
│                                                                        │
│  ESCOLAS (searchable, sortable, filterable table)                      │
│  [ search ] [status ▾] [risco ▾]                    [cards|tabela] view │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ Escola ▾ │ Idade │ WAU │ Alunos │ Aulas 30d │ Aprov. │ Saúde    │   │
│  │ Auto A   │ 8m    │ 22  │ 140    │  96 ▂▄▆█  │ 78%    │ 🟢 Saud. │   │
│  │ Auto B   │ 3m    │ 4   │ 61     │  12 ▆▂▁▁  │ 55%    │ 🟠 Risco │   │
│  │ …        │       │     │        │ sparkline │        │          │   │
│  └────────────────────────────────────────────────────────────────┘   │
│  ‹ 1 2 3 … › (offset pagination, ITEMS_PER_PAGE)                       │
└──────────────────────────────────────────────────────────────────────┘
```

- **Health badge** is text + color + icon (never color alone — a11y): 🟢 Saudável / 🟠 Em risco / ⚪ Novo / ⚫ Inativo, per §8.2.
- Each row is a sparkline of classes/enrollments last 8 weeks (tiny Recharts or inline SVG) + click-through to the account page.
- Table is offset-paginated (`pagination.tsx`, `ITEMS_PER_PAGE`), filters URL-synced. Group toggle: view by **school** (default) or roll up by **tenant** (a tenant may own several schools).
- **tRPC:** `admin.portfolio.overview({ page, pageSize, search, status, risk, sort })` → `{ items, total }`; `admin.portfolio.kpis()`; `admin.portfolio.trends({ rangeDays })`. SSR-prefetched to match client inputs exactly.

### 5.2 Per-account page — `admin.convlyx.com/tenants/[tenantId]` (+ school section)

Purpose: the deep dive. One tenant, its schools, everything about it — aggregates + staff contacts only. This is the "dedicated page per tenant/school" you asked for.

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← Visão geral                                                         │
│  Auto-Escola Central          🟢 Saudável   Ativa desde jul 2025 (12m) │
│  subdomínio: central · 2 escolas · [Ações ▾ (sub-proj 2)]              │
├──────────────────────────────────────────────────────────────────────┤
│  SNAPSHOT (SnapshotRow w/ deltas)                                      │
│  Alunos ativos · Instrutores · WAU · Aulas 30d · Aprovação · Últ. ativ.│
│                                                                        │
│  [ Escola: Todas ▾ ]  [ intervalo: 90d ▾ ]     ← filters, URL-synced   │
│                                                                        │
│  CHARTS (ChartCard grid) — reuse analytics components where possible   │
│  ┌ Inscrições ao longo do tempo (bar) ┐ ┌ Aulas: teórica vs prática ┐  │
│  ┌ Funil de inscrição (ENROLLED→…)    ┐ ┌ Taxa aprovação p/ categoria┐  │
│  ┌ Conclusão de cursos (donut)        ┐ ┌ Utilização de turmas       ┐  │
│                                                                        │
│  MEMBROS (breakdown by role)   │  TIMELINE DE ATIVIDADE               │
│  Admins 2 · Secret. 3 · Instr. │  • há 2h  aula criada (por J. Silva) │
│  8 · Alunos 140                 │  • ontem  check-in x14               │
│  ── staff contacts listed ──   │  • 3d     exame agendado             │
│  (students: count only; names  │  • …  (from ClassSession/Exam/       │
│   behind gated action §7)      │        checkedInAt/lastSeenAt)       │
│                                                                        │
│  CONFIG            │  CONSENTIMENTOS (DPA / termos)  │  NOTIFICAÇÕES    │
│  timezone, cancel. │  coverage %, latest versions    │  volume by type │
│  notice, self-enrol│                                  │                 │
└──────────────────────────────────────────────────────────────────────┘
```

- **Staff contacts** (admin/secretary/instructor names, emails, phones) shown inline — they're the operator's counterparties, low-risk. **Student identities are NOT** shown here — only counts. A "Ver alunos" button is the gated action (§7).
- Charts reuse `enrolments-over-time`, `attendance-trend`, `pass-rate-by-category`, `instructor-workload` where the shape matches; new ones (funnel, course-completion donut, utilization) follow the same conventions.
- **tRPC:** `admin.account.get({ tenantId })` (header + snapshot + members + config + consents), `admin.account.charts({ tenantId, schoolId?, rangeDays })`, `admin.account.timeline({ tenantId, cursor })`. Aggregates only; no PII in any of these payloads.

---

## 6. Sub-project 2 — Operational actions

Mutations, all through `admin/ops.ts` (`adminProcedure`), all audited, all confirmed with a dialog. Surfaced via the **[Ações ▾]** menu on the account page + row actions on the overview.

| Action | Effect | Audit verb | Notes |
|---|---|---|---|
| Suspender tenant | `Tenant.status = INACTIVE` | `tenant.suspend` | **Must verify** the tenant-INACTIVE path actually locks users out (middleware/`protectedProcedure`). If it doesn't today, add that enforcement as part of this sub-project — a suspend that doesn't suspend is a bug. |
| Reativar tenant | `Tenant.status = ACTIVE` | `tenant.reactivate` | |
| Editar tenant | rename | `tenant.update` | |
| Editar escola | name, address, phone, timezone, `cancellationNoticeHours`, `practicalSelfEnrollEnabled` | `school.update` | Schema has no `School.status`; per-school disable is out of scope unless we add that column (flagged as optional). |
| Gerir admins | list a school's ADMIN memberships; deactivate/reactivate (`Membership.status`); trigger Supabase password reset / resend invite | `membership.deactivate` / `membership.reactivate` / `admin.invite_resend` | Reuses service-role client pattern from existing `api/platform-admin/admins`. |
| Criar escola/admin | (existing dialogs) | already audited | Optionally migrate the DB portion into `ops.ts`; not required. |

Destructive actions require typing the tenant/school name to confirm (guardrail). No hard-delete — soft via status, consistent with the app's soft-delete convention.

---

## 7. Sub-project 3 — Support & impersonation

> **Amendment (2026-07-14, implemented):** §7.2 view-as was **descoped from true app impersonation to a read-only support view rendered inside the admin console** (audited `admin.support.getStudent` + a read-only detail page). Rationale: real impersonation would modify the shared auth path (`middleware` / `createTRPCContext` / `getDashboardUser`) that every live tenant user hits, and this project can only be tested in prod (no dev credentials) — too high-risk. The console-rendered read-only view delivers the diagnostic value (same underlying data) at zero auth-path risk. True token-based impersonation remains specced below for a future round once auth changes can be tested safely (dev credentials or a staging tenant). §7.1 shipped as specced.

The only surfaces that touch individual end-user PII. Both gated + audited.

### 7.1 Gated student lookup — `admin.support.getStudent`
- From the account page "Ver alunos" button → a list of a school's students (name, email, enrollment/course/exam summary). Each open of this list writes `audit("student.view", target=school, metadata={count})`; opening an individual record writes `audit("student.view_detail", target=user)`.
- Rationale banner shown: "A visualização de dados pessoais fica registada." Optional free-text reason captured into audit `metadata`.

### 7.2 View-as / impersonation — `admin.support.impersonate`
Most complex + security-sensitive; specced here, built last.

- **Model:** operator requests a **read-only** view-as for a target user. `adminProcedure` issues a short-lived (e.g. 15 min) signed token `{ operatorEmail, targetUserId, tenantId, mode: "readonly", exp }`, audited as `impersonation.start`.
- **Enforcement in the app:** `createTRPCContext` recognises the token, builds context as the target user **but** flags `impersonating = true`; `protectedProcedure`/mutations **reject writes** when `impersonating` (read-only). A persistent, unmissable banner ("A ver como <user> · sessão de suporte · sair") renders app-wide while active. Ending or expiry writes `impersonation.end`.
- **Why read-only first:** lets support *see what the user sees* to diagnose, with zero risk of an operator mutating a customer's data under their identity. A future "read-write with explicit escalation" mode is possible but deliberately deferred.
- **Alternative considered & rejected for v1:** full Supabase session minting via service-role (`generateLink`/admin sign-in). Heavier, and grants write by default — worse posture. The signed-token + read-only context approach keeps the blast radius small and the audit trail clean.

---

## 8. Cross-cutting design

### 8.1 GDPR / legal (processor posture)
- Aggregates: unrestricted for allowlisted operators.
- Individual PII + impersonation: deliberate, reason-capturable, **always** audited (`AuditLog`) with operator email, timestamp, tenant/target.
- No PII in aggregate query payloads (enforced by keeping `account.*` queries count-only).
- Impersonation is read-only in v1 (§7.2).
- AuditLog metadata never carries secrets (existing convention).
- A short `docs/decisions/` note will record this posture (per the team's "document all decisions" rule).

### 8.2 "At-risk" heuristic (single definition, used everywhere)
A school is:
- **⚪ Novo** — age < 21 days (too early to judge).
- **⚫ Inativo** — parent `Tenant.status = INACTIVE`.
- **🟠 Em risco** — active tenant, past the new-window, that *was* active but has gone quiet: **no class created, no check-in, and no `lastSeenAt` activity in the last 14 days**, OR classes-created in the last 30d dropped ≥60% vs the prior 30d. (Until the heartbeat has ≥14d of history, fall back to class/check-in signals only, and label accordingly.)
- **🟢 Saudável** — active and not matching the above.
Thresholds are constants in one module (`src/server/lib/admin-health.ts`) so they're tunable in one place. Exact numbers are a starting point, easy to adjust after we see real data.

### 8.3 Performance
- All admin API routes/handlers pinned `preferredRegion = "dub1"` (co-located with Supabase), per the perf decision doc.
- Overview + account pages SSR-prefetch their main queries (mirror client inputs exactly) — no skeleton flash.
- Cross-tenant aggregate queries use `groupBy`/`count` with the existing composite indexes (`Enrollment[tenantId, enrolledAt]`, `[tenantId, status, enrolledAt]`); add `Membership[tenantId, lastSeenAt]`. Avoid N+1 across tenants — batch with grouped queries, not per-tenant loops.
- Heartbeat write is throttled (≤1/hr/user) and never awaited on the request path.

### 8.4 Testing
- Unit: at-risk heuristic (`admin-health.ts`) across boundary cases; `platform-admin` allowlist parsing; heartbeat throttle logic.
- Integration (tRPC): `adminProcedure` rejects non-allowlisted; aggregate queries return correct grouped counts against seed data; audit rows written for PII reads / mutations / impersonation.
- Impersonation: token issue → read-only context → mutation rejected → banner state → expiry.
- Follow the repo's existing test conventions/harness.

---

## 9. Build order (each sub-project = its own plan → implementation)

1. **Sub-project 1 — Insights core** *(build first)*
   - Phase 0: foundation — `platform-admin.ts` helper + refactor 4 call-sites; `adminProcedure` + `admin` router skeleton; `lastSeenAt` migration + heartbeat; `admin-health.ts`.
   - Phase 1: portfolio overview page.
   - Phase 2: per-account page.
2. **Sub-project 2 — Operational actions** (needs `admin.ops`; verify + enforce tenant-suspend lockout).
3. **Sub-project 3 — Support & impersonation** (gated lookup, then read-only view-as).

Each is independently shippable and leaves the panel more useful than before.

---

## 10. Open questions / future
- **Billing panel** — unlocked only if/when monetization data exists (external Stripe read or new models). Out of scope now.
- **`School.status`** — add a per-school active/inactive column? Only if you want to disable one school without the whole tenant. Flagged, not assumed.
- **Full activity-event log** — richer than the heartbeat (per-action timelines); deferred as likely overkill for internal-only. Revisit if the heartbeat proves too coarse.
- **Impersonation read-write mode** — deliberately deferred; read-only covers diagnosis.
- **Exports** — CSV export of the overview table for offline analysis? Cheap to add later if useful.

# Supabase keep-alive — preventing free-plan project pausing

**Date:** 2026-08-03
**Status:** Implemented
**Scope:** Both Supabase projects (production + dev/preview)

## Problem

The dev Supabase project paused itself after 7 days of no use, which blocks local
development and migrations until someone restores it by hand from the dashboard.

Both projects are on the **Free plan**, so this is not only a dev-workflow
annoyance: the same rule applies to production. A quiet week — August, when
Portuguese driving schools slow down — could pause the live product for every
school using Convlyx, with no automatic recovery.

## What Supabase actually measures

From [Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing):
a Free project is considered inactive when it "does not receive sufficient user
database activity over the past week", and "typically a few user requests to the
database each day over the previous week is enough to keep the project from being
paused."

Two things follow from that wording, and they drove the design:

1. **The metric is requests per day across the week, not one touch inside a
   7-day window.** So the ping runs *twice daily*, not "every 5 days" as
   originally sketched. It also means one delayed or failed run is harmless,
   whereas a single ping every 5 days has no margin at all.
2. **A read is activity.** Supabase says "requests", not "writes". This is also
   what the widely used [supabase-pause-prevention](https://github.com/travisvn/supabase-pause-prevention)
   tool does. So we do not persist anything — see "Read, not write" below.

Supabase does not publish the exact threshold or metric, so this cannot be
proven from documentation alone. The verification plan is empirical: the dev
project is the natural test: if it survives past 7 days with only this workflow
touching it, reads count.

## Decision

A GitHub Actions workflow, `.github/workflows/keep-alive.yml`, runs twice daily
and makes one authenticated PostgREST read per project:

```
GET {SUPABASE_URL}/rest/v1/tenants?select=id&limit=1
```

No application code, no Prisma model, no migration, no new runtime environment
variables, and no `.env.example` change. Both projects are treated identically,
as two independent steps so one failing cannot mask the other.

### Why GitHub Actions, not a Vercel cron

- The Hobby plan allows **2 cron jobs, once per day**. One slot is already spent
  on `/api/cron/reminders`. Spending the last one on housekeeping is a poor
  trade, and once-per-day is the ceiling rather than a choice.
- A production Vercel function reaching the **dev** database would require the
  dev project's credentials in the production environment — mixing environments
  for a maintenance job, and widening the production blast radius.
- This is infrastructure housekeeping, not product behaviour. It does not belong
  in the tRPC/API surface that the future React Native client consumes.

### Why HTTP (PostgREST), not psql

A `psql` ping from a GitHub runner would connect through `DATABASE_URL`'s 6543
transaction pooler. Per
[the prod DB routing investigation](./2026-06-24-prod-db-routing-investigation.md),
6543 **routes by network origin**: from a non-Vercel origin it can reach the
leftover "ghost" instance from the Apr-2026 compute change. A ping could then
report success against the wrong backend while the live project drifted toward
pausing — the worst possible failure mode for a keep-alive, because it is
silent.

Going over the project's REST endpoint opens no Postgres connection at all, so
that entire class of problem disappears. (A psql variant would have to use
`DIRECT_URL`/5432; not worth the extra moving part.)

### Why read, not write

The original instinct was to persist a meaningless row. Rejected because it buys
nothing measurable — reads already count as activity — and it costs a Prisma
model plus a migration applied to *both* databases, and the dev database has
known migration drift that makes any migration there non-trivial. The ping
queries a real table rather than `SELECT 1` so it is indistinguishable from
ordinary user traffic.

If a project ever pauses despite this workflow, the escalation is a single-row
heartbeat table upserted on the same schedule. We would know within a week.

### Why the service-role key

Four repository secrets: `SUPABASE_PROD_URL`,
`SUPABASE_PROD_SERVICE_ROLE_KEY`, `SUPABASE_DEV_URL`,
`SUPABASE_DEV_SERVICE_ROLE_KEY`.

The alternative was the anon key, which is already public (it ships in the
browser bundle), so storing it adds no exposure. It was rejected on
**reliability**: an anon read only succeeds if `anon` currently holds SELECT on
`tenants`, and it would silently stop working the day RLS policies are added to
that table. A keep-alive that fails quietly is worse than none, because the
failure surfaces only once the database is already paused. The service-role key
bypasses RLS and grants, so the ping is stable across any future permissions
work.

`convlyx/convlyx` is a **public** repository, so that choice is paired with
deliberate hardening in the workflow:

- Triggers are `schedule` and `workflow_dispatch` only — never `pull_request`,
  so fork PRs can never receive these secrets. `workflow_dispatch` requires repo
  write access.
- **No third-party actions** — no supply-chain path to the secrets.
- **No `actions/checkout`** — repository code never executes in the job, so
  committed code cannot read the keys.
- `permissions: {}` — the job's `GITHUB_TOKEN` has no scopes.

The keys remain rotatable from the Supabase dashboard.

## Rejected: pg_cron inside the database

Tempting, since `scripts/sync-class-statuses.cron.sql` already establishes the
pattern. It cannot work for this problem:

- Internal cron activity is not an inbound user request, so it is unlikely to
  register as the activity Supabase measures.
- More fundamentally, when a project pauses, its Postgres — and therefore its
  pg_cron jobs — stops with it. The keep-alive would die at exactly the moment
  it is needed.

## Rejected: external pinger (UptimeRobot / cron-job.org)

Fewest moving parts, but the configuration lives in a third-party dashboard
rather than the repository: invisible to code review, undocumented, and easy to
forget exists. `/api/health` remains available for uptime pinging (a separate
concern — keeping a function instance and DB pool warm), but it only covers
production and does not address pausing.

## Operational notes

- **The dev project must be restored manually once** (Supabase dashboard) before
  the workflow can keep it awake — a paused project cannot be pinged back to
  life over the REST API.
- Failures are loud: `--fail-with-body` fails the step on any non-2xx, and
  GitHub emails on failed scheduled runs.
- GitHub disables scheduled workflows in repositories with 60 days of no
  activity, warning by email first. Not a practical concern at the current
  commit cadence.

## Follow-ups (not part of this change)

- **Production on the Free plan is the larger risk.** A paused production
  project is a full outage until manually restored, and Free also means no PITR
  and a 500 MB ceiling on a live product holding GDPR-relevant data. Pro removes
  pausing as a category of problem. This workflow mitigates; it does not fix the
  underlying posture.
- **Possible anon-key read exposure.** If Supabase's default public-schema
  grants applied when Prisma created the tables, the public anon key may be able
  to read business tables such as `tenants` over PostgREST today. `CLAUDE.md`
  notes RLS is unused because Prisma connects as a superuser that bypasses it —
  but that reasoning does not cover the REST API path, which connects as `anon`.
  Worth verifying separately.

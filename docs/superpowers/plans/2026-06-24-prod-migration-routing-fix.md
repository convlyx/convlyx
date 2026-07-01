# Prod Migration-Routing Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Definitively determine which physical Postgres each connection path (local pooler, local direct, Supabase dashboard, live Vercel runtime) actually reaches, reconcile migration state on the cluster the live app uses, and either restore a single automated migration step or document the confirmed manual workflow with evidence.

**Architecture:** This is a **diagnostic + operational** plan, not a feature build. It adds a small, throwaway fingerprinting tool (a local `pg` script + a secret-gated API route) that reports a cluster's unique `system_identifier` plus its migration state, uses it to build a definitive routing map, then acts on the finding. Because the outcome is unknown up front, Tasks 4–6 branch on what Tasks 2–3 reveal. The diagnostic code is removed (or left gated) at the end.

**Tech Stack:** Node `pg` (already a dependency), `tsx`, Next.js App Router API route, Prisma 7, Supabase Postgres (project `idvupzweddgjcolgrluz`), Vercel (`dub1`).

> **This plan is investigation-first and largely operator-run.** Many steps require credentials/consoles only the operator (Francisco) has: the Supabase dashboard SQL Editor, the Vercel project env vars, and a local `.env.prod`. Steps are labelled **[agent]** (safe to run from this repo) or **[operator]** (needs a console/secret). All prod writes are read-only diagnostics except (a) a throwaway marker table that is dropped again and (b) the one pending migration in Task 5.

## Global Constraints

- **Do NOT re-add `prisma migrate deploy` to the `build` script** (`package.json:7`) until routing is *provably* consistent — this is the exact regression `CLAUDE.md` "KNOWN ISSUE" warns against.
- **Do NOT trust `db:migrate:status:prod` or `db:migrate:deploy:prod`** (`package.json:17,20`) for diagnosis — they route through the suspect URL. Use the fingerprint tool instead.
- **Never commit secrets.** Connection strings, passwords, and `CRON_SECRET` must never enter git or the findings doc. `system_identifier`, server IP, and migration counts are safe to record.
- **Read-only first.** The only prod writes permitted by this plan are the throwaway `_conn_diag` marker table (dropped in Task 6) and the single pending migration `20260604193700_add_school_time_zone` (Task 5).
- **Package manager is pnpm.** Run all scripts via `pnpm`, never `npm` (npm 10.5.0 crashes on this dep tree).
- **The diagnostic endpoint is secret-gated** (Bearer `CRON_SECRET`) and returns no tenant data — it must never be public.
- **Pending migration SQL (verbatim):** `ALTER TABLE "schools" ADD COLUMN "time_zone" TEXT NOT NULL DEFAULT 'Europe/Lisbon';` (folder `20260604193700_add_school_time_zone`).

---

## Prerequisites (confirm before starting)

- [ ] `.env.prod` exists locally with real `DATABASE_URL` (6543) + `DIRECT_URL` (5432). (Confirmed present in repo root; contents not read by this plan.)
- [ ] Operator has Supabase dashboard SQL Editor access for project `idvupzweddgjcolgrluz`.
- [ ] Operator can read the Vercel project's `DATABASE_URL` / `DIRECT_URL` env values.
- [ ] `CRON_SECRET` value is known to the operator (already set in prod env per `.env.prod.example:11`).

---

## Task 1: Build the fingerprint tooling

**Files:**
- Create: `scripts/db-fingerprint.ts`
- Create: `src/app/api/_diag/db-fingerprint/route.ts`
- Modify: `package.json:15-27` (add two scripts)

**Interfaces:**
- Produces: a **fingerprint object** shape reused by every later task —
  `{ path: string, system_identifier: string, server_addr: string | null, server_port: number | null, database: string, postmaster_start_time: string, has_school_time_zone: boolean, timezone_migration_recorded: number }`.
- Produces: `pnpm db:fingerprint:prod` (pooler / `DATABASE_URL`) and `pnpm db:fingerprint:prod:direct` (`DIRECT_URL`).
- Produces: `GET /api/_diag/db-fingerprint` (Bearer `CRON_SECRET`) returning the same shape with `path: "vercel-runtime"`.

- [ ] **Step 1 [agent]: Create the local fingerprint script**

Create `scripts/db-fingerprint.ts`:

```ts
import { Pool } from "pg";

// Which prod connection to fingerprint:
//   default            → DATABASE_URL  (transaction pooler, 6543)  — what the app runtime uses
//   --direct           → DIRECT_URL    (session pooler, 5432)      — what migrations use
const useDirect = process.argv.includes("--direct");
const which = useDirect ? "local-direct(5432)" : "local-pooler(6543)";
const url = useDirect ? process.env.DIRECT_URL : process.env.DATABASE_URL;

// Shared fingerprint query — MUST stay identical to the one in
// src/app/api/_diag/db-fingerprint/route.ts so all paths are comparable.
const FINGERPRINT_SQL = `
  SELECT
    (SELECT system_identifier::text FROM pg_control_system())                 AS system_identifier,
    inet_server_addr()::text                                                  AS server_addr,
    inet_server_port()                                                        AS server_port,
    current_database()                                                        AS database,
    pg_postmaster_start_time()::text                                          AS postmaster_start_time,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'schools' AND column_name = 'time_zone'
    )                                                                         AS has_school_time_zone,
    CASE WHEN to_regclass('public._prisma_migrations') IS NOT NULL
         THEN (SELECT count(*)::int FROM public._prisma_migrations
               WHERE migration_name = '20260604193700_add_school_time_zone')
         ELSE -1 END                                                         AS timezone_migration_recorded
`;

async function main() {
  if (!url) {
    console.error(`No connection string for ${which}. Run via: pnpm db:fingerprint:prod[:direct]`);
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 15000 });
  try {
    const { rows } = await pool.query(FINGERPRINT_SQL);
    console.log(JSON.stringify({ path: which, ...rows[0] }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2 [agent]: Create the secret-gated runtime endpoint**

Create `src/app/api/_diag/db-fingerprint/route.ts` (mirrors the cron route's Bearer-auth pattern in `src/app/api/cron/reminders/route.ts`):

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";

// Co-locate with Supabase (Dublin) and never cache — must hit the real runtime DB.
export const preferredRegion = "dub1";
export const dynamic = "force-dynamic";

// TEMPORARY diagnostic — remove or keep gated per Task 6. Reports which physical
// Postgres the live Vercel app actually connects to via its DATABASE_URL, plus the
// state of the pending timezone migration. Returns NO tenant data.
type Fingerprint = {
  system_identifier: string;
  server_addr: string | null;
  server_port: number | null;
  database: string;
  postmaster_start_time: string;
  has_school_time_zone: boolean;
  timezone_migration_recorded: number;
};

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // $queryRaw uses the raw client and bypasses the tenant-scope extension — fine here.
  const rows = await db.$queryRaw<Fingerprint[]>`
    SELECT
      (SELECT system_identifier::text FROM pg_control_system())                 AS system_identifier,
      inet_server_addr()::text                                                  AS server_addr,
      inet_server_port()                                                        AS server_port,
      current_database()                                                        AS database,
      pg_postmaster_start_time()::text                                          AS postmaster_start_time,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'schools' AND column_name = 'time_zone'
      )                                                                         AS has_school_time_zone,
      CASE WHEN to_regclass('public._prisma_migrations') IS NOT NULL
           THEN (SELECT count(*)::int FROM public._prisma_migrations
                 WHERE migration_name = '20260604193700_add_school_time_zone')
           ELSE -1 END                                                         AS timezone_migration_recorded
  `;
  return NextResponse.json({ path: "vercel-runtime", ...rows[0] });
}
```

- [ ] **Step 3 [agent]: Add package scripts**

In `package.json`, add after `db:migrate:status:prod` (line 20):

```json
        "db:fingerprint:prod": "dotenv -e .env.prod -- tsx scripts/db-fingerprint.ts",
        "db:fingerprint:prod:direct": "dotenv -e .env.prod -- tsx scripts/db-fingerprint.ts --direct",
```

- [ ] **Step 4 [agent]: Verify the tooling compiles and runs against DEV first**

Run (dev DB — proves the query/tool works before pointing at prod):

```bash
pnpm type-check
dotenv -e .env -- tsx scripts/db-fingerprint.ts
```

Expected: `type-check` passes; the script prints a JSON object with a non-empty `system_identifier`, `database: "postgres"`, `has_school_time_zone: true` (dev has the migration), and `timezone_migration_recorded: 1`. If `pg_control_system()` errors with a permission error, see the note below.

> **Fallback if `pg_control_system()` is not permitted on the pooled role:** replace the `system_identifier` sub-select in BOTH files with `(SELECT concat(pg_postmaster_start_time()::text, '|', inet_server_addr()::text)) AS system_identifier`. `postmaster_start_time` + server IP together still uniquely fingerprint a cluster; the marker-table check in Task 3 is the definitive backstop regardless.

- [ ] **Step 5: Commit** (message below — do not commit secrets; `.env.prod` is gitignored)

```
chore(diag): add prod DB fingerprint script + gated endpoint

Temporary tooling to map which physical Postgres each connection path
reaches (local pooler/direct, dashboard, Vercel runtime) and report
pending-migration state. Endpoint is Bearer CRON_SECRET gated. Removed
in the routing-fix cleanup task.
```

---

## Task 2: Collect fingerprints from all four paths

**Files:**
- Create: `docs/decisions/2026-06-24-prod-db-routing-investigation.md`

**Interfaces:**
- Consumes: `pnpm db:fingerprint:prod[:direct]` and `GET /api/_diag/db-fingerprint` from Task 1.
- Produces: a filled comparison table + the raw `system_identifier` values used by Tasks 4–5.

- [ ] **Step 1 [operator]: Deploy the endpoint to production**

The endpoint only exists once deployed. Trigger a normal production deploy (git push to `main` per the existing Vercel setup, or `vercel deploy --prod` if the CLI is installed). Wait for it to go live.

- [ ] **Step 2 [operator]: Fingerprint the local pooler + direct paths**

```bash
pnpm db:fingerprint:prod
pnpm db:fingerprint:prod:direct
```

Record both JSON outputs. Expected: two objects; note whether their `system_identifier` values match each other.

> **Discriminator note (confirmed on dev during Task 1):** `inet_server_port()` reports `5432` (the Postgres backend port) even when connected through the 6543 pooler, so **the port field alone will NOT distinguish pooler from direct**. Compare `system_identifier` (and secondarily `server_addr`) — those are the reliable discriminators.

- [ ] **Step 3 [operator]: Fingerprint the live Vercel runtime**

PowerShell (apex domain; if middleware/tenant routing intercepts it, retry against the raw production `*.vercel.app` deployment URL):

```powershell
curl.exe -s -H "Authorization: Bearer <CRON_SECRET>" https://convlyx.com/api/_diag/db-fingerprint
```

Expected: a JSON object with `path: "vercel-runtime"`. This is the **source of truth** — it is the DB the live app actually reads and writes.

- [ ] **Step 4 [operator]: Fingerprint the Supabase dashboard**

In the Supabase SQL Editor for project `idvupzweddgjcolgrluz`, run:

```sql
SELECT
  (SELECT system_identifier::text FROM pg_control_system())                 AS system_identifier,
  inet_server_addr()::text                                                  AS server_addr,
  inet_server_port()                                                        AS server_port,
  current_database()                                                        AS database,
  pg_postmaster_start_time()::text                                          AS postmaster_start_time,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name = 'schools' AND column_name = 'time_zone')       AS has_school_time_zone,
  CASE WHEN to_regclass('public._prisma_migrations') IS NOT NULL
       THEN (SELECT count(*)::int FROM public._prisma_migrations
             WHERE migration_name = '20260604193700_add_school_time_zone')
       ELSE -1 END                                                          AS timezone_migration_recorded;
```

- [ ] **Step 5 [operator]: Compare Vercel env vs `.env.prod`**

In the Vercel dashboard, read the project's `DATABASE_URL` and `DIRECT_URL` (Production scope). Without copying secrets into git, note whether the **host, port, and `[PROJECT_REF]`** match `.env.prod`. A mismatch here (e.g. different project ref or region) is itself a candidate root cause.

- [ ] **Step 6 [agent]: Write the findings doc**

Create `docs/decisions/2026-06-24-prod-db-routing-investigation.md` with this table filled in (safe values only — no connection strings):

```markdown
# Prod DB routing investigation — 2026-06-24

Fingerprints (see plan 2026-06-24-prod-migration-routing-fix.md, Task 2):

| Path                     | system_identifier | server_addr | postmaster_start_time | has_school_time_zone | tz_migration_recorded |
|--------------------------|-------------------|-------------|-----------------------|----------------------|-----------------------|
| local pooler (6543)      |                   |             |                       |                      |                       |
| local direct (5432)      |                   |             |                       |                      |                       |
| Vercel runtime           |                   |             |                       |                      |                       |
| Supabase dashboard       |                   |             |                       |                      |                       |

Vercel env vs .env.prod: [match / MISMATCH — describe which fields differ]
```

- [ ] **Step 7: Commit** (message: `docs(diag): record prod DB routing fingerprints`)

---

## Task 3: Definitive marker-table cross-check

**Files:** none (SQL run via tooling / dashboard).

**Interfaces:**
- Consumes: the confirmed pooler path (`pnpm db:fingerprint:prod`) and dashboard access.
- Produces: a yes/no answer — "does a row written via the app's pooler path appear in the dashboard?" — appended to the findings doc.

This repeats, rigorously, the original observation in `CLAUDE.md` ("a marker table written via Prisma was visible to Prisma but not the dashboard"). The `system_identifier` comparison in Task 2 should already answer the question; this is the tactile confirmation to include in the Supabase ticket.

- [ ] **Step 1 [operator]: Write a marker via the local pooler path**

```bash
dotenv -e .env.prod -- tsx -e "const {Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL,max:1});await p.query('CREATE TABLE IF NOT EXISTS _conn_diag (id uuid primary key default gen_random_uuid(), source text, at timestamptz default now())');const r=await p.query(\"INSERT INTO _conn_diag(source) VALUES('local-pooler') RETURNING id\");console.log('inserted',r.rows[0].id);await p.end();})()"
```

Expected: prints `inserted <uuid>`. Record the UUID.

- [ ] **Step 2 [operator]: Look for that row in the dashboard**

In the Supabase SQL Editor run:

```sql
SELECT * FROM _conn_diag ORDER BY at DESC;
```

- **If the row from Step 1 is ABSENT** → the pooler and the dashboard are different physical clusters. Split confirmed. (Consistent with differing `system_identifier` in Task 2.)
- **If the row is PRESENT** → pooler and dashboard share a cluster; the split is NOT between pooler and dashboard (re-examine the Vercel-runtime fingerprint and the env comparison from Task 2 for the real discrepancy).

- [ ] **Step 3 [operator]: Cross-check from the runtime's perspective (optional but ideal)**

If the Vercel-runtime `system_identifier` differs from the local pooler in Task 2, also confirm the runtime can/can't see the marker by temporarily querying `_conn_diag` — reuse the diagnostic endpoint pattern only if needed, otherwise rely on `system_identifier`.

- [ ] **Step 4 [agent]: Append the result** to `docs/decisions/2026-06-24-prod-db-routing-investigation.md` (marker UUID, present/absent in dashboard, conclusion). Commit (`docs(diag): marker-table cross-check result`).

> **Cleanup of `_conn_diag` is handled in Task 6** (must drop it on every cluster it was created on).

---

## Task 4: Diagnose root cause, choose remediation branch

**Files:**
- Modify: `docs/decisions/2026-06-24-prod-db-routing-investigation.md`
- Create (conditional): `docs/decisions/supabase-ticket-draft.md`

**Interfaces:**
- Consumes: the fingerprint table (Task 2) + marker result (Task 3).
- Produces: a named diagnosis and the chosen branch for Task 5/6.

- [ ] **Step 1 [agent]: Classify the finding** into exactly one branch and write it into the doc:

- **Branch A — Env mismatch (best case).** Vercel's `DATABASE_URL`/`DIRECT_URL` point at a *different project/ref/region* than `.env.prod` and/or the dashboard. Root cause is configuration, not Supabase infrastructure. → Remediation: correct the env vars so runtime (`DATABASE_URL`) and migrations (`DIRECT_URL`) target the **same** cluster the dashboard manages. This likely also *resolves the KNOWN ISSUE outright*.
- **Branch B — Genuine pooler split.** Same project ref everywhere, but the pooler `system_identifier` differs from the direct/dashboard `system_identifier`. Root cause is Supabase-side pooler routing. → Remediation: open a Supabase support ticket (Step 2) and, until resolved, keep migrations + runtime pinned to whichever connection path shares the dashboard's cluster (probably the 5432 direct/session path); consider a clean-project migration (open decision A1 in the spec).
- **Branch C — All identifiers match.** No split exists anymore (or never did at the layer we assumed). → Remediation: the manual workflow can likely be retired; proceed to Task 5 to reconcile state, then Task 6 to re-enable automation.

- [ ] **Step 2 [operator, Branch B only]: Draft the Supabase support ticket**

Create `docs/decisions/supabase-ticket-draft.md` containing: project ref `idvupzweddgjcolgrluz`; the fingerprint table (system_identifiers side by side); the marker-table repro; explicit statement that no branching is enabled and a password reset did not change it; the ask ("why does the pooler endpoint resolve to a different physical cluster than the direct endpoint / dashboard, and how do we converge them?"). Commit (`docs(diag): draft Supabase support ticket`).

---

## Task 5: Reconcile migration state on the live cluster

**Files:**
- Reference: `prisma/migrations/20260604193700_add_school_time_zone/migration.sql`

**Interfaces:**
- Consumes: the Task 4 diagnosis — specifically, **which connection path reaches the cluster the live Vercel app uses** (the runtime fingerprint from Task 2 is authoritative).
- Produces: `has_school_time_zone: true` and `timezone_migration_recorded: 1` on the app's runtime cluster.

> **Act on the cluster the LIVE APP uses**, identified by the `vercel-runtime` fingerprint — not necessarily the dashboard's cluster. If Branch A applies, first fix the env vars (below) so they converge, then apply once.

- [ ] **Step 1 [operator, Branch A]: Correct the Vercel env vars**

Update the Vercel Production `DATABASE_URL` (6543) and `DIRECT_URL` (5432) to the correct project/region so both, and the dashboard, share one cluster. Redeploy. Re-run the Task 2 fingerprints and confirm **all four `system_identifier` values now match**. Only then continue.

- [ ] **Step 2 [operator]: Check whether the column already exists on the app's cluster**

Read the `has_school_time_zone` field from the **`vercel-runtime`** fingerprint (Task 2, re-run if env changed).
- If `true` and `timezone_migration_recorded: 1` → nothing to apply; skip to Step 4.
- If `has_school_time_zone: false` → apply Step 3.
- If `has_school_time_zone: true` but `timezone_migration_recorded: 0` → column exists but is unrecorded; skip Step 3's `ALTER`, run only the `_prisma_migrations` INSERT in Step 3.

- [ ] **Step 3 [operator]: Apply the pending migration to the app's cluster**

Run against the connection that reaches the runtime cluster (the dashboard SQL Editor **only if** its `system_identifier` matches the runtime's; otherwise via `dotenv -e .env.prod -- tsx -e "..."` using whichever URL matched):

```sql
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "time_zone" TEXT NOT NULL DEFAULT 'Europe/Lisbon';

INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, applied_steps_count)
VALUES (gen_random_uuid()::text, 'manual', now(), '20260604193700_add_school_time_zone', 1)
ON CONFLICT DO NOTHING;
```

(`IF NOT EXISTS` / `ON CONFLICT DO NOTHING` make this safe to re-run.)

- [ ] **Step 4 [operator]: Verify from the app's perspective**

Re-run the runtime fingerprint:

```powershell
curl.exe -s -H "Authorization: Bearer <CRON_SECRET>" https://convlyx.com/api/_diag/db-fingerprint
```

Expected: `has_school_time_zone: true`, `timezone_migration_recorded: 1`. Also load a page that reads `school.timeZone` in prod and confirm no error.

- [ ] **Step 5 [agent]: Update the pending-migration memory/doc** — note in the findings doc that `20260604193700_add_school_time_zone` is now applied + recorded on the runtime cluster. Commit (`docs(diag): confirm timezone migration applied to runtime cluster`).

---

## Task 6: Resolve — restore automation or document manual; clean up

**Files:**
- Modify: `CLAUDE.md` ("KNOWN ISSUE" section, ~lines 128-159)
- Modify: `docs/TODO.md`
- Delete or gate: `src/app/api/_diag/db-fingerprint/route.ts`
- Delete: `scripts/db-fingerprint.ts` (and its `package.json` scripts) unless kept intentionally

**Interfaces:**
- Consumes: the Task 4 branch decision + Task 5 verified state.

- [ ] **Step 1 [operator]: Drop the marker table everywhere it exists**

On the local pooler path AND (if it was created there) the dashboard cluster:

```sql
DROP TABLE IF EXISTS _conn_diag;
```

Confirm gone from both perspectives.

- [ ] **Step 2 [agent]: Restore automation (Branch A or C) OR keep manual (Branch B)**

- **Branch A / C (routing now consistent):** re-enable a single automated migration step. Add a dedicated deploy step rather than stuffing it into `build` (keeps generate/build fast and makes migration failures obvious):
  - Add script to `package.json`: `"db:migrate:deploy:prod": "dotenv -e .env.prod -- prisma migrate deploy"` is already present — verify it now targets the correct cluster by running `pnpm db:migrate:status:prod` and confirming it reports the timezone migration as applied (it should, post-Task 5). Document that `migrate deploy` is trustworthy again.
  - Decide (open decision, surface to Francisco): wire `prisma migrate deploy` into the Vercel deploy (e.g. a deploy hook or CI job on `main`) vs. keep it a deliberate manual `pnpm db:migrate:deploy:prod`. Do **not** silently add it to `build`.
- **Branch B (split unresolved):** leave the manual workflow in place. Update `CLAUDE.md` KNOWN ISSUE with the concrete `system_identifier` evidence and a link to `docs/decisions/2026-06-24-prod-db-routing-investigation.md`, and note the Supabase ticket reference.

- [ ] **Step 3 [agent]: Update `CLAUDE.md`** — replace the speculative KNOWN ISSUE wording with the confirmed diagnosis (which path hits which cluster), the resolution taken, and the link to the investigation doc. If Branch A/C, rewrite it from "auto-migration is disabled" to the new trustworthy workflow.

- [ ] **Step 4 [agent]: Update `docs/TODO.md`** — tick/annotate the migration-routing item with the outcome.

- [ ] **Step 5 [agent]: Remove or gate the diagnostic tooling**

Preferred: delete `src/app/api/_diag/db-fingerprint/route.ts`, delete `scripts/db-fingerprint.ts`, and remove the two `db:fingerprint:prod*` scripts from `package.json`. (If keeping for future ops, leave them but confirm the endpoint stays Bearer-gated and add a one-line note in `CLAUDE.md`.)

- [ ] **Step 6 [operator]: Deploy** the cleanup and confirm `GET /api/_diag/db-fingerprint` returns 404 (if removed).

- [ ] **Step 7: Commit** (message below)

```
fix(db): resolve prod migration routing + reconcile migration state

Document confirmed root cause (see docs/decisions/2026-06-24-prod-db-
routing-investigation.md), apply the pending timezone migration to the
runtime cluster, [restore automated migrate deploy | keep documented
manual workflow], and remove the temporary fingerprint tooling.
```

---

## Self-Review notes

- **Spec coverage (workstream A):** Supabase ticket → Task 4 Step 2 (Branch B). Empirically confirm which DB `DATABASE_URL` hits → Tasks 2–3. Reconcile `_prisma_migrations` + pending migration → Task 5. Goal state (single automated step, only once consistent) → Task 6. Open decision A1 (clean-project migration) → surfaced in Task 4 Branch B. All covered.
- **Conditional-by-design:** Tasks 4–6 branch because the root cause is genuinely unknown until Tasks 2–3 run — this is inherent to a diagnostic plan, not a placeholder. Each branch has concrete, complete actions.
- **No secrets in git:** enforced in Global Constraints and every operator step records only `system_identifier`/IPs/counts.
- **Shared query consistency:** the fingerprint SQL is identical in `scripts/db-fingerprint.ts`, the API route, and the dashboard snippet (Task 2 Step 4) so all four paths are comparable.
```
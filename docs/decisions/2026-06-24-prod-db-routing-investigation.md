# Prod DB routing investigation — 2026-06-24

Fingerprints (see plan `docs/superpowers/plans/2026-06-24-prod-migration-routing-fix.md`, Task 2).
`system_identifier` is the unique physical-cluster ID; two independent clusters have
different values. A shared value means shared lineage (clone/branch/replica) or the
same cluster.

| Path                     | system_identifier   | server_addr (IPv6, /64 prefix `2a05:d018:135e:16e0`) | postmaster_start_time         | has_school_time_zone | tz_migration_recorded |
|--------------------------|---------------------|------------------------------------------------------|-------------------------------|----------------------|-----------------------|
| local pooler (6543)      | 7623125441096521075 | …:f07b:976c:c7db:db84                                | 2026-04-17 18:21:10.918348+00 | true                 | 1                     |
| local direct (5432)      | 7623125441096521075 | …:c476:3cc0:3ebb:f3bc                                | 2026-04-19 14:07:07.88778+00  | true                 | 1                     |
| Supabase dashboard       | 7623125441096521075 | …:c476:3cc0:3ebb:f3bc                                | 2026-04-19 14:07:07.88778+00  | true                 | 1                     |
| **Vercel runtime**       | 7623125441096521075 | …:**c476**:3cc0:3ebb:f3bc                            | 2026-04-19 14:07:07.88778+00  | true                 | 1                     |
| dev (.env, from Task 1)  | 7623125441096521075 | (not recorded)                                       | (not recorded)                | true                 | 1                     |

Project refs (password-masked): dev `.env` = `wqtxugtngkpywjtvfkky`, prod `.env.prod` = `idvupzweddgjcolgrluz` — **different Supabase projects**. Deploy confirmed current: 404 page's Sentry release matched local HEAD `9fad2bf`.

Vercel env vs .env.prod: **PENDING** — compare once the runtime fingerprint is obtained.

## Observations (preliminary — runtime fingerprint still missing)

1. **The transaction pooler (6543, the app's runtime path) and the session pooler
   (5432, migrations) / dashboard hit DIFFERENT physical Postgres instances.** Evidence:
   different `server_addr` (…f07b… vs …c476…) AND different `postmaster_start_time`
   (Apr 17 vs Apr 19). Two distinct running servers. This is the measured signature of
   the "two physical DBs" phenomenon `CLAUDE.md` documented.
2. **But they share `system_identifier`** → shared lineage. Same-identifier + different
   postmaster/IP is the classic primary↔read-replica signature (a replica is a physical
   copy, so it inherits the identifier but starts at its own time). Could also be two
   forked primaries.
3. **The pending timezone migration is applied AND recorded on ALL three tested paths**
   (`has_school_time_zone: true`, `tz_migration_recorded: 1`). So the specific
   migration-drift symptom is NOT currently reproducing — the app's pooler path already
   sees the migration. If (2) is a read replica, that's expected (writes replicate).
4. **dev and prod share `system_identifier` but are SEPARATE projects** (refs
   `wqtxugtngkpywjtvfkky` vs `idvupzweddgjcolgrluz`). RESOLVED: prod was physically
   cloned/branched from dev at setup, so it inherited the identifier. Not entangled —
   benign. Caveat: `system_identifier` therefore can't distinguish dev from prod, but we
   use separate env files so it doesn't matter for routing.

## Open items before concluding

- **Vercel runtime fingerprint** — the actual source of truth. Endpoint 404'd (not live).
- **dev vs prod project-ref comparison** — resolves observation (4).
- ~~Determine whether the 6543 instance is a read replica~~ **DONE: no replica.**
  Supabase dashboard → Database → Replication shows only "Primary Database, West EU
  (Ireland) eu-west-1" — no replica configured. So the different-postmaster/different-IP
  result between the 6543 pooler and the 5432/dashboard path is NOT a read replica; it
  is genuine Supabase pooler-layer behavior (the phenomenon `CLAUDE.md` documented).
  Mitigating factor: same `system_identifier` + timezone migration present on both →
  no current data/schema drift. Whether a *future* migration applied via 5432 reliably
  reaches the 6543 path the app uses is the open risk — settle it empirically with the
  Task 3 marker test and the runtime fingerprint.

## Diagnosis (2026-07-01)

**The production data path is CONSISTENT.** The live Vercel runtime, the local 5432
direct/migration path, and the Supabase dashboard all reach the **same physical
instance** — identical `server_addr` (…c476…) AND identical `postmaster_start_time`
(Apr 19), not merely the same lineage. The pending timezone migration is applied and
recorded there. So migrations applied via `DIRECT_URL` (5432) land on the exact instance
the live app reads.

**The lone outlier is the LOCAL machine's 6543 transaction-pooler connection** (…f07b…,
Apr 17). It is the only path that reached a different instance. That is almost certainly
the origin of the historical "two physical DBs" confusion in `CLAUDE.md`: comparing a
local 6543-pooler write against the dashboard showed a mismatch — but the *production
app* never used that path.

**Anomaly to escalate (non-blocking):** two running Postgres instances (…f07b…/Apr 17
and …c476…/Apr 19) share one `system_identifier` with no replica configured. Abnormal
for a single-primary project. Worth a Supabase support ticket, but it does not affect
production correctness today.

**Root cause CONFIRMED (2026-07-01).** Vercel's `DATABASE_URL` is byte-for-byte identical
to `.env.prod` — port **6543**, same host, same ref. Yet Vercel-on-6543 reaches `c476`
(the real primary) while the **local machine on the same 6543 string reaches `f07b`** (the
ghost). ⇒ Supabase's transaction pooler (Supavisor) routes the identical connection string
to different physical backends by network origin. Vercel (Dublin, co-located) → live
primary; local (Portugal) → a stale leftover instance from the Apr 19 compute change that
was never decommissioned. This is the origin of the `CLAUDE.md` "two physical DBs" report:
the original marker-table test was run locally via 6543 (→ ghost) and compared to the
dashboard (→ primary). It was never a production issue.

**Implication for the plan:** this is effectively **Branch C** (no split on the
production path). Task 5 (reconcile migration state) is already satisfied — the timezone
migration is present on the app's instance. Before re-enabling automated `migrate deploy`
(Task 6), still (a) run the Task 3 marker test to empirically confirm write-through on
the production path, and (b) confirm the Vercel `DATABASE_URL` above.

## Pipeline confirmed (2026-07-01)

`20260701120000_add_consent_records` was applied to prod via `pnpm db:migrate:deploy:prod`
(prisma migrate deploy, DIRECT_URL/5432 → the live instance) — **no dashboard hand-paste,
no manual `_prisma_migrations` insert**. `db:migrate:status:prod` beforehand showed 11 prior
migrations applied + only this one pending (no checksum-drift complaint on the prod path).
This is the end-to-end confirmation that the automated migration path reaches the DB the app
uses. The manual hand-paste workflow is retired.

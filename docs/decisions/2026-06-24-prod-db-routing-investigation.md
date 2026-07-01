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
| Vercel runtime           | **PENDING REDEPLOY** — first curl 404'd because the route folder was named `_diag` (Next.js treats leading-underscore folders as private/non-routable). Renamed to `diag`; endpoint is now `/api/diag/db-fingerprint`, awaiting redeploy. |||||
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
- **Determine whether the 6543 instance is a read replica** (Supabase dashboard →
  Database → Replicas) — this decides whether (1) is benign (replica, auto-syncs) or
  dangerous (forked primary, drifts).

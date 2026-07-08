# Backups & Disaster Recovery — runbook

**Date:** 2026-07-01
**Status:** Tooling shipped (per-tenant export/restore + whole-DB dump script). Backup *scheduling* decision pending (see §6).

## The two layers

1. **Whole-DB backup — the primary net.** A logical dump of the entire Postgres
   instance: **every schema**, so it captures `auth` (logins + password hashes),
   `public` (all app data, all tenants), and every foreign key consistently.
   This is what guarantees full recovery. Produced by Supabase's managed backups
   *or* our `db:backup` script (`pg_dump`).
2. **Per-tenant export/restore — the granular complement.** Recover or relocate
   *one* school. Managed backups can't do surgical single-tenant recovery without
   a disruptive full restore; these scripts can.

### Why associations are safe, and why auth is included
Every class↔student / class↔instructor / exam link is a foreign key to the
Prisma **`User`** table (keyed by `User.id`), all of which the export captures —
so restoring reconstitutes associations exactly; classes are never orphaned.

The subtlety: the app links `User.id === auth.users.id` (same UUID). If you only
restored app data and re-invited users, Supabase would mint **new** UUIDs and
disconnect them from their restored data. So the per-tenant export **also
captures `auth.users` + `auth.identities`** (via `to_jsonb`, restored with
`jsonb_populate_recordset`), preserving original UUIDs + password hashes →
logins work and stay linked to the data. A whole-DB dump captures auth inherently.

## Security (read before running)
Both the tenant JSON and the `pg_dump` file contain **personal data and password
hashes**. Treat them like credentials:
- Never commit them (`tenant-*.json` and `db-backup-*.dump` are gitignored).
- Store encrypted and offsite; delete local copies when done.
- Restrict who can run these (they use `DIRECT_URL`, which holds the DB password).

## 1. Tooling (shipped)

All connect via `DIRECT_URL`/5432 (the trustworthy path; never the 6543 pooler).

| Command | What it does |
|---|---|
| `pnpm db:backup:prod [outFile]` | `pg_dump` the whole prod DB → custom-format `.dump`. Needs `pg_dump` on PATH (Postgres 16). |
| `pnpm db:tenant-export:prod <tenantId> [outFile]` | Export one tenant (public rows + auth) → `tenant-<id>-<date>.json`. Read-only. |
| `pnpm db:tenant-restore:prod <file.json> [--force]` | Restore one tenant into a DB where it's absent. Refuses if the tenant already exists (use `--force` to override). One transaction. |

(Dev variants without `:prod` exist for drills against the dev DB.)

## 2. Restore — whole DB (worst case: instance lost/corrupted)
- **Supabase managed backup:** dashboard → Database → Backups → restore the chosen
  point (or PITR timestamp) into the project (or a new project).
- **From a `pg_dump` file:** `pg_restore --clean --if-exists --no-owner --no-privileges -d "<DIRECT_URL>" db-backup-<stamp>.dump` (into a fresh/empty target).
- Verify afterward: app loads, a known tenant's classes/users are present, a user can log in.

## 3. Restore — a single tenant (accidental deletion / move to a fresh project)
1. Get the snapshot (`db:tenant-export` output; take one *before* any risky op).
2. Ensure the target DB does **not** already contain that `tenantId` (fresh
   project, or after removing the damaged copy).
3. `pnpm db:tenant-restore:prod tenant-<id>-<date>.json`
4. Verify: the tenant's schools/users/classes are back and correctly associated;
   a user in that tenant can log in with their existing password.

## 4. RTO / RPO
- **RPO** (data-loss window) = your backup interval. Daily backups → up to ~24h.
  PITR → seconds. `db:backup` → whatever cadence you schedule it.
- **RTO** (time to restore): whole-DB restore is minutes–tens-of-minutes;
  single-tenant restore is seconds–minutes.

## 5. Test the drill (do this once, then periodically)
Backups you've never restored aren't backups. Drill on the **dev** DB:
1. `pnpm db:tenant-export <devTenantId>`
2. Wipe/point at a scratch DB, then `pnpm db:tenant-restore <file>`.
3. Confirm counts match and a restored user can authenticate.

## 6. Decision pending — how to schedule whole-DB backups
Pick one (per-tenant tooling above is independent of this):
- **Supabase Pro (~$25/mo)** — managed daily backups, ~7-day retention; also
  removes the free-tier idle-pause and raises limits. **Recommended at launch.**
- **Free `pg_dump` cron** — schedule `db:backup` (e.g. a GitHub Actions workflow
  with `DIRECT_URL` as a secret + upload to an object store). $0, you own
  retention/rotation; more setup. Good if deferring Pro.
- **PITR add-on** (paid, on top of Pro) — sub-day recovery. Optional; daily
  backups are usually enough for this scale. Skip unless a need appears.

**Action:** confirm the current Supabase tier's backup guarantees, then choose
Pro (recommended) or wire the `pg_dump` cron. Until then, run `db:backup:prod`
manually before any risky operation.

import "dotenv/config";
import { Pool } from "pg";

/**
 * Reconcile `memberships` against `users`. Two operations:
 *
 *  1. CREATE MISSING (always safe, idempotent) — insert a Membership for every
 *     user that lacks one in their own tenant, derived from the User row. The
 *     safety net for any creation path that forgot to write a Membership (e.g.
 *     the break-glass `admin-create-user` script before it was fixed): without
 *     it the user is locked out of every `protectedProcedure`.
 *
 *  2. RECONCILE EXISTING (--reconcile only) — overwrite an existing
 *     Membership's role/status/school/qualifications from its User row when
 *     they diverge. Needed once after the Phase-2 #3b deploy: user.update /
 *     deactivate / activate used to write only the User columns, so any change
 *     made before #3b left the Membership stale.
 *
 *     ⚠️ ONLY valid while Membership mirrors User 1:1 (i.e. before the
 *     invite-into-second-school feature ships — Phase 2 #3c). Once a person can
 *     belong to multiple tenants, Membership becomes authoritative and User a
 *     stale mirror; reconciling FROM User would then clobber correct data.
 *     Do not run --reconcile after #3c.
 *
 * Connects via the session pooler (DIRECT_URL/5432), never the 6543 pooler
 * (see CLAUDE.md "PROD DB ROUTING").
 *
 *   pnpm dotenv -e .env.prod -- tsx scripts/backfill-memberships.ts             # dry run (report only)
 *
 * To apply, pass flags OR set env vars (the env-var form avoids the pnpm/dotenv
 * `--` arg-forwarding gotcha that can swallow flags). PowerShell:
 *   $env:APPLY="1"; pnpm dotenv -e .env.prod -- tsx scripts/backfill-memberships.ts
 *   $env:APPLY="1"; $env:RECONCILE="1"; pnpm dotenv -e .env.prod -- tsx scripts/backfill-memberships.ts
 */

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const apply = process.argv.includes("--apply") || process.env.APPLY === "1";
const reconcile = process.argv.includes("--reconcile") || process.env.RECONCILE === "1";

const SELECT_MISSING = `
  SELECT u.id, u.email, u.role, u.status, u.tenant_id, u.school_id
  FROM users u
  WHERE NOT EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.user_id = u.id AND m.tenant_id = u.tenant_id
  )
  ORDER BY u.created_at DESC
`;

const INSERT_MISSING = `
  INSERT INTO memberships (
    id, tenant_id, user_id, school_id, role, status,
    qualified_categories, novidades_seen_at, created_at, updated_at
  )
  SELECT gen_random_uuid(), u.tenant_id, u.id, u.school_id, u.role, u.status,
         u.qualified_categories, u.novidades_seen_at, now(), now()
  FROM users u
  WHERE NOT EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.user_id = u.id AND m.tenant_id = u.tenant_id
  )
`;

// Rows where the Membership diverges from its User row on any mirrored column.
const SELECT_DIVERGED = `
  SELECT u.email, m.role AS m_role, u.role AS u_role,
         m.status AS m_status, u.status AS u_status
  FROM memberships m
  JOIN users u ON u.id = m.user_id AND u.tenant_id = m.tenant_id
  WHERE m.role <> u.role
     OR m.status <> u.status
     OR m.school_id <> u.school_id
     OR m.qualified_categories <> u.qualified_categories
  ORDER BY u.email
`;

const UPDATE_DIVERGED = `
  UPDATE memberships m
  SET role = u.role,
      status = u.status,
      school_id = u.school_id,
      qualified_categories = u.qualified_categories,
      updated_at = now()
  FROM users u
  WHERE m.user_id = u.id AND m.tenant_id = u.tenant_id
    AND (m.role <> u.role
      OR m.status <> u.status
      OR m.school_id <> u.school_id
      OR m.qualified_categories <> u.qualified_categories)
`;

async function main() {
  if (!connectionString) {
    console.error("No DIRECT_URL / DATABASE_URL set in the environment.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 15000 });
  try {
    // --- 1. Missing memberships ---
    const missing = (await pool.query(SELECT_MISSING)).rows;
    if (missing.length === 0) {
      console.log("✔ No users are missing a membership.");
    } else {
      console.log(`Found ${missing.length} user(s) without a membership in their tenant:\n`);
      for (const r of missing) {
        console.log(
          `  ${r.email}  role=${r.role} status=${r.status} tenant=${String(r.tenant_id).slice(0, 8)} school=${String(r.school_id).slice(0, 8)}`,
        );
      }
    }

    // --- 2. Diverged memberships (reporting always; fixing only with --reconcile) ---
    const diverged = (await pool.query(SELECT_DIVERGED)).rows;
    if (diverged.length === 0) {
      console.log("✔ No memberships diverge from their User row.");
    } else {
      console.log(`\nFound ${diverged.length} membership(s) out of sync with their User row:\n`);
      for (const r of diverged) {
        console.log(
          `  ${r.email}  role: ${r.m_role}→${r.u_role}  status: ${r.m_status}→${r.u_status}`,
        );
      }
    }

    if (!apply) {
      console.log(
        "\n(dry run) Set APPLY=1 to create missing memberships." +
          (diverged.length > 0 ? " Add RECONCILE=1 to also sync diverged ones." : ""),
      );
      return;
    }

    if (missing.length > 0) {
      const res = await pool.query(INSERT_MISSING);
      console.log(`\n✔ Created ${res.rowCount} membership(s).`);
    }

    if (diverged.length > 0) {
      if (!reconcile) {
        console.log(
          "\n⚠ Skipped reconciling diverged memberships (RECONCILE not set). " +
            "Only run RECONCILE=1 before the invite-into-second-school feature (Phase 2 #3c) ships.",
        );
      } else {
        const res = await pool.query(UPDATE_DIVERGED);
        console.log(`✔ Reconciled ${res.rowCount} membership(s) from their User row.`);
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

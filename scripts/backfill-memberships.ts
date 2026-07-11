import "dotenv/config";
import { Pool } from "pg";

/**
 * Reconcile `memberships` against `users`: create a Membership for every user
 * that lacks one in their own tenant, derived from the User row's role/school/
 * status/categories. Idempotent — the NOT EXISTS guard plus the
 * `@@unique([tenant_id, user_id])` constraint make re-runs a no-op.
 *
 * This is the safety net for the migration backfill: any user created through a
 * path that forgot to write a Membership (e.g. the break-glass
 * `admin-create-user` script before it was fixed) is locked out of every
 * `protectedProcedure` once the phase-1 fallback was removed. Running this
 * gives them their membership back.
 *
 * Connects via the session pooler (DIRECT_URL/5432), never the 6543 pooler
 * (see CLAUDE.md "PROD DB ROUTING").
 *
 *   pnpm dotenv -e .env.prod -- tsx scripts/backfill-memberships.ts          # dry run (report only)
 *
 * To actually apply, pass `--apply` OR set APPLY=1 (the env-var form avoids the
 * pnpm/dotenv `--` arg-forwarding gotcha that can swallow the flag). PowerShell:
 *   $env:APPLY="1"; pnpm dotenv -e .env.prod -- tsx scripts/backfill-memberships.ts
 */

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const apply = process.argv.includes("--apply") || process.env.APPLY === "1";

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

async function main() {
  if (!connectionString) {
    console.error("No DIRECT_URL / DATABASE_URL set in the environment.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 15000 });
  try {
    const missing = (await pool.query(SELECT_MISSING)).rows;
    if (missing.length === 0) {
      console.log("✔ No users are missing a membership. Nothing to do.");
      return;
    }

    console.log(`Found ${missing.length} user(s) without a membership in their tenant:\n`);
    for (const r of missing) {
      console.log(
        `  ${r.email}  role=${r.role} status=${r.status} tenant=${String(r.tenant_id).slice(0, 8)} school=${String(r.school_id).slice(0, 8)}`,
      );
    }

    if (!apply) {
      console.log("\n(dry run) Re-run with --apply to create the missing memberships.");
      return;
    }

    const res = await pool.query(INSERT_MISSING);
    console.log(`\n✔ Created ${res.rowCount} membership(s).`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import "dotenv/config";
import { writeFileSync } from "node:fs";
import { Pool } from "pg";

/**
 * Export a single tenant to a JSON snapshot — the granular DR complement to a
 * whole-DB backup. Captures every tenant-scoped row across the public schema
 * PLUS the tenant's Supabase `auth.users` + `auth.identities` rows, so a
 * restore preserves logins (original UUIDs + password hashes) and therefore
 * every class/enrollment/exam association keyed by `User.id`.
 *
 * Bulk/admin op — connects via the session pooler (DIRECT_URL/5432), never the
 * 6543 transaction pooler (see CLAUDE.md "PROD DB ROUTING").
 *
 *   pnpm db:tenant-export:prod <tenantId> [outFile]
 *
 * ⚠️ The output contains password hashes — store encrypted, never commit,
 * delete after use. (`tenant-*.json` is gitignored.)
 */

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const tenantId = process.argv[2];

// Tenant-scoped public tables carrying a tenant_id. Order is the FK-safe
// RESTORE order (parents before children) so the same list drives
// tenant-restore. `users` is NOT here — it's the global identity (no tenant_id)
// and is exported separately via the tenant's memberships (see below).
const SCOPED_TABLES = [
  "schools",
  "memberships",
  "student_courses",
  "class_sessions",
  "exams",
  "enrollments",
  "notifications",
  "push_subscriptions",
  "consent_records",
] as const;

async function main() {
  if (!connectionString) {
    console.error("No DIRECT_URL / DATABASE_URL set in the environment.");
    process.exit(1);
  }
  if (!tenantId) {
    console.error("Usage: tenant-export <tenantId> [outFile]");
    process.exit(1);
  }

  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 15000 });
  try {
    const tenantRows = (
      await pool.query("SELECT to_jsonb(t) AS row FROM tenants t WHERE id = $1", [tenantId])
    ).rows.map((r) => r.row);
    if (tenantRows.length === 0) {
      console.error(`Tenant ${tenantId} not found.`);
      process.exit(1);
    }

    const tables: Record<string, unknown[]> = { tenants: tenantRows };

    // Global users belonging to this tenant = those with a membership here.
    // (They may also belong to other tenants; that's fine — restore upserts.)
    const users = (
      await pool.query(
        `SELECT to_jsonb(u) AS row FROM users u
         WHERE u.id IN (SELECT user_id FROM memberships WHERE tenant_id = $1)`,
        [tenantId],
      )
    ).rows.map((r) => r.row);
    tables.users = users;

    for (const t of SCOPED_TABLES) {
      // `t` comes only from the hardcoded SCOPED_TABLES list — not user input.
      const { rows } = await pool.query(
        `SELECT to_jsonb(x) AS row FROM ${t} x WHERE tenant_id = $1`,
        [tenantId],
      );
      tables[t] = rows.map((r) => r.row);
    }

    const userIds = (tables.users as Array<{ id: string }>).map((u) => u.id);
    const authUsers = userIds.length
      ? (
          await pool.query("SELECT to_jsonb(u) AS row FROM auth.users u WHERE id = ANY($1::uuid[])", [userIds])
        ).rows.map((r) => r.row)
      : [];
    const authIdentities = userIds.length
      ? (
          await pool.query("SELECT to_jsonb(i) AS row FROM auth.identities i WHERE user_id = ANY($1::uuid[])", [userIds])
        ).rows.map((r) => r.row)
      : [];

    const snapshot = {
      format: "convlyx.tenant.v1",
      exportedAt: new Date().toISOString(),
      tenantId,
      tables,
      auth: { users: authUsers, identities: authIdentities },
    };

    const date = new Date().toISOString().slice(0, 10);
    const outFile = process.argv[3] ?? `tenant-${tenantId}-${date}.json`;
    writeFileSync(outFile, JSON.stringify(snapshot, null, 2));

    const counts = Object.entries(tables)
      .map(([k, v]) => `${k}=${v.length}`)
      .join(" ");
    console.log(`Exported tenant ${tenantId} → ${outFile}`);
    console.log(`  ${counts} auth.users=${authUsers.length} auth.identities=${authIdentities.length}`);
    console.warn(
      "⚠️  This file contains auth rows including password hashes — store it securely, never commit it, and delete it when done.",
    );
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

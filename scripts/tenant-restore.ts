import "dotenv/config";
import { readFileSync } from "node:fs";
import { Pool, type PoolClient } from "pg";

/**
 * Restore a single tenant from a `convlyx.tenant.v1` snapshot (produced by
 * tenant-export). Re-inserts the tenant's Supabase auth rows + all public-schema
 * rows, preserving original UUIDs so logins and every association survive.
 *
 * v1 semantics: restore into a DB where the tenant is ABSENT (disaster recovery
 * / move a tenant to a fresh project). Refuses if the tenantId already exists,
 * unless `--force`. Runs in one transaction — all-or-nothing.
 *
 * Bulk/admin op — connects via DIRECT_URL/5432 (see CLAUDE.md "PROD DB ROUTING").
 *
 *   pnpm db:tenant-restore:prod <file.json> [--force]
 */

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const file = process.argv[2];
const force = process.argv.includes("--force");

// Insert order: auth schema first (public.users may carry a FK to auth.users),
// then public tables parents-before-children.
const PUBLIC_ORDER = [
  "tenants",
  "schools",
  "users",
  "student_courses",
  "class_sessions",
  "exams",
  "enrollments",
  "notifications",
  "push_subscriptions",
  "consent_records",
] as const;

async function insertSet(client: PoolClient, table: string, rows: unknown[]) {
  if (!rows || rows.length === 0) return;
  // `table` values come only from the hardcoded lists below — not user input.
  await client.query(
    `INSERT INTO ${table} SELECT * FROM jsonb_populate_recordset(NULL::${table}, $1::jsonb)`,
    [JSON.stringify(rows)],
  );
  console.log(`  ${table}: ${rows.length}`);
}

async function main() {
  if (!connectionString) {
    console.error("No DIRECT_URL / DATABASE_URL set in the environment.");
    process.exit(1);
  }
  if (!file) {
    console.error("Usage: tenant-restore <file.json> [--force]");
    process.exit(1);
  }

  const snapshot = JSON.parse(readFileSync(file, "utf8"));
  if (snapshot.format !== "convlyx.tenant.v1") {
    console.error(`Unexpected snapshot format: ${snapshot.format}`);
    process.exit(1);
  }
  const tenantId: string = snapshot.tenantId;

  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 15000 });
  const client = await pool.connect();
  try {
    const exists = (await client.query("SELECT 1 FROM tenants WHERE id = $1", [tenantId])).rowCount ?? 0;
    if (exists && !force) {
      console.error(
        `Tenant ${tenantId} already exists in the target DB. Refusing to restore.\n` +
          `Restore into a DB where the tenant is absent (fresh project / after a wipe), ` +
          `or pass --force to attempt inserts anyway (may fail on primary-key conflicts).`,
      );
      process.exit(1);
    }

    await client.query("BEGIN");

    // Auth first, so a potential public.users → auth.users FK is satisfied.
    await insertSet(client, "auth.users", snapshot.auth?.users ?? []);
    await insertSet(client, "auth.identities", snapshot.auth?.identities ?? []);

    for (const t of PUBLIC_ORDER) {
      await insertSet(client, `public.${t}`, snapshot.tables?.[t] ?? []);
    }

    await client.query("COMMIT");
    console.log(`Restored tenant ${tenantId} from ${file}.`);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

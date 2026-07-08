import "dotenv/config";
import { spawnSync } from "node:child_process";

/**
 * Whole-database logical backup via `pg_dump` (custom format). Captures ALL
 * schemas — including `auth` (logins/password hashes) and `public` (all app
 * data, all tenants) — in one consistent snapshot. This is the primary
 * "can we fully recover" net; tenant-export is the granular complement.
 *
 * Requires the `pg_dump` binary on PATH, matching the server's major version
 * (Postgres 16). Restore with `pg_restore` (see the DR runbook).
 *
 * Bulk/admin op — uses DIRECT_URL/5432 (see CLAUDE.md "PROD DB ROUTING").
 *
 *   pnpm db:backup:prod [outFile]
 *
 * ⚠️ Output contains ALL data incl. password hashes — store encrypted/offsite,
 * never commit. (`db-backup-*.dump` is gitignored.)
 */

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

function main() {
  if (!connectionString) {
    console.error("No DIRECT_URL / DATABASE_URL set in the environment.");
    process.exit(1);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = process.argv[2] ?? `db-backup-${stamp}.dump`;

  const res = spawnSync(
    "pg_dump",
    ["--format=custom", "--no-owner", "--no-privileges", "--file", outFile, connectionString],
    { stdio: "inherit" },
  );

  if (res.error) {
    console.error(
      `pg_dump could not be run (is it installed and on PATH, matching Postgres 16?): ${res.error.message}`,
    );
    process.exit(1);
  }
  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }

  console.log(`Whole-DB backup written → ${outFile}`);
  console.warn(
    "⚠️  Contains ALL data including auth password hashes — store it encrypted and offsite, never commit it.",
  );
}

main();

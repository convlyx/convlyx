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

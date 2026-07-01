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

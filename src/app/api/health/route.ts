import { NextResponse } from "next/server";
import { db } from "@/server/db";

// Pin to Dublin (eu-west-1) to co-locate with Supabase — avoids transatlantic DB latency.
export const preferredRegion = "dub1";
// Always run fresh — this must actually hit the function/DB to keep them warm.
export const dynamic = "force-dynamic";

/**
 * Lightweight health/warmth probe. Point an external uptime pinger
 * (e.g. UptimeRobot, cron-job.org) at this every ~5 minutes to keep a function
 * instance and its DB connection pool warm on the Hobby plan, so the first real
 * navigation after an idle period isn't a cold start. Best-effort — it raises
 * the odds that user traffic lands on a warm instance, not a guarantee.
 *
 * Public + minimal on purpose: it only confirms the app can reach the DB and
 * returns no tenant data.
 */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}

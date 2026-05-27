import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { syncClassStatuses } from "@/server/lib/class-status";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

/**
 * Cron: bump every tenant's class statuses based on the wall clock.
 *
 * Runs every minute via Vercel cron. Used to live inline on `class.list`
 * — moved here so high-traffic read paths stop doing tenant-wide writes.
 *
 * Tradeoff: a class that ended <1 min ago may still display as
 * IN_PROGRESS until the next sweep. UI flows that gate on status
 * (mark-attendance, cancel, edit) handle both IN_PROGRESS and COMPLETED
 * gracefully, so the brief lag is invisible to end users.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const { success } = rateLimit({ key: `cron:${ip}`, limit: 2, windowMs: 60000 });
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { startedCount, completedCount } = await syncClassStatuses(db);

  logger.info("cron:sync-class-statuses", { startedCount, completedCount });

  return NextResponse.json({
    success: true,
    startedCount,
    completedCount,
  });
}

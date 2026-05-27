import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Auto-updates class session statuses based on current time.
 *
 * SCHEDULED → IN_PROGRESS: when now >= startsAt
 * IN_PROGRESS → COMPLETED: when now >= endsAt
 *
 * CANCELLED classes are never auto-updated.
 *
 * Run from a Vercel cron (every 1–2 min) — not from read paths. Used to
 * be called on every `class.list` which made each list view do a
 * tenant-wide UPDATE; that's now centralised here so reads stay pure.
 *
 * Pass `tenantId` to scope the sweep (used by tenant-specific tooling);
 * omit to sweep every tenant in one pass (used by the cron).
 */
export async function syncClassStatuses(db: PrismaClient, tenantId?: string) {
  const now = new Date();
  const tenantFilter = tenantId ? { tenantId } : {};

  // Move SCHEDULED → IN_PROGRESS (class has started)
  const started = await db.classSession.updateMany({
    where: {
      ...tenantFilter,
      status: "SCHEDULED",
      startsAt: { lte: now },
    },
    data: { status: "IN_PROGRESS" },
  });

  // Move IN_PROGRESS → COMPLETED (class has ended)
  const completed = await db.classSession.updateMany({
    where: {
      ...tenantFilter,
      status: "IN_PROGRESS",
      endsAt: { lte: now },
    },
    data: { status: "COMPLETED" },
  });

  return { startedCount: started.count, completedCount: completed.count };
}

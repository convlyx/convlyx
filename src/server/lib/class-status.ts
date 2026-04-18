import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Auto-updates class session statuses based on current time.
 * Called on class list queries to ensure statuses are always accurate.
 *
 * SCHEDULED → IN_PROGRESS: when now >= startsAt
 * IN_PROGRESS → COMPLETED: when now >= endsAt
 *
 * CANCELLED classes are never auto-updated.
 */
export async function syncClassStatuses(db: PrismaClient, tenantId: string) {
  const now = new Date();

  // Move SCHEDULED → IN_PROGRESS (class has started)
  await db.classSession.updateMany({
    where: {
      tenantId,
      status: "SCHEDULED",
      startsAt: { lte: now },
    },
    data: { status: "IN_PROGRESS" },
  });

  // Move IN_PROGRESS → COMPLETED (class has ended)
  await db.classSession.updateMany({
    where: {
      tenantId,
      status: "IN_PROGRESS",
      endsAt: { lte: now },
    },
    data: { status: "COMPLETED" },
  });
}

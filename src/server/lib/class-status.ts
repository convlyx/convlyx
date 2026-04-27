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

  // Find classes about to be completed (still IN_PROGRESS but ended)
  const completingClasses = await db.classSession.findMany({
    where: {
      tenantId,
      status: "IN_PROGRESS",
      endsAt: { lte: now },
    },
    select: { id: true },
  });

  if (completingClasses.length > 0) {
    const completingIds = completingClasses.map((c) => c.id);

    // Move IN_PROGRESS → COMPLETED
    await db.classSession.updateMany({
      where: { id: { in: completingIds } },
      data: { status: "COMPLETED" },
    });
  }

}

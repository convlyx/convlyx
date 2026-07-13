import type { PrismaClient } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";

/** Update lastSeenAt at most once per hour per active membership. */
export const HEARTBEAT_INTERVAL_MS = 60 * 60 * 1000;

/** Pure throttle decision — tested in isolation. */
export function shouldHeartbeat(lastSeenAt: Date | null, now: Date): boolean {
  if (!lastSeenAt) return true;
  return now.getTime() - lastSeenAt.getTime() >= HEARTBEAT_INTERVAL_MS;
}

/**
 * Fire-and-forget activity write. Never awaited on the request path and never
 * throws — a failed heartbeat must not affect the user's request. Uses the raw
 * db with an explicit (userId, tenantId) filter; updateMany avoids the
 * findUnique restriction on tenant-scoped models.
 */
export async function recordHeartbeat(
  db: PrismaClient,
  userId: string,
  tenantId: string,
  lastSeenAt: Date | null,
): Promise<void> {
  const now = new Date();
  if (!shouldHeartbeat(lastSeenAt, now)) return;
  try {
    await db.membership.updateMany({
      where: { userId, tenantId },
      data: { lastSeenAt: now },
    });
  } catch (error) {
    logger.warn("heartbeat write failed", { error, userId, tenantId });
  }
}

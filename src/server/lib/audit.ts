import type { PrismaClient } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";

/**
 * Write one row to `audit_logs` for a platform-admin action. Best-effort:
 * failures here log a warning but never abort the caller. The audit log is
 * a diagnostic trail, not a transactional consistency requirement — if it
 * misses one row the platform admin's action still succeeded.
 *
 * Keep metadata small and free of secrets. Common payload shape:
 *   - tenant.create   → { name }
 *   - school.create   → { name, subdomain, tenantId }
 *   - admin.create    → { email, schoolId, tenantId }
 */
export async function audit(params: {
  db: PrismaClient;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await params.db.auditLog.create({
      data: {
        actorEmail: params.actorEmail,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        // Prisma's Json column won't accept a literal `null` via this path
        // (wants Prisma.JsonNull); omit the field instead when absent.
        ...(params.metadata ? { metadata: params.metadata as object } : {}),
      },
    });
  } catch (error) {
    logger.warn("audit log write failed", {
      error,
      action: params.action,
      targetId: params.targetId,
    });
  }
}

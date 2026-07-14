import type { Prisma } from "@/generated/prisma/client";

/** Pure filter builder for the audit-log viewer. `now` is injected for testability. */
export function buildAuditWhere(
  input: { action?: string; actor?: string; target?: string; sinceDays?: number },
  now: Date,
): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  if (input.action) where.action = input.action;
  if (input.actor) where.actorEmail = input.actor;
  if (input.target) where.targetId = input.target;
  if (input.sinceDays && input.sinceDays > 0) {
    where.createdAt = { gte: new Date(now.getTime() - input.sinceDays * 86_400_000) };
  }
  return where;
}

import { Prisma } from "@/generated/prisma/client";
import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Tenant-scope Prisma extension.
 *
 * Wraps a Prisma client so every query against a tenant-scoped model
 * automatically carries `tenantId = <currentRequestTenantId>`. Catches
 * the "forgot to filter by tenantId" bug at the ORM layer.
 *
 * Used by `protectedProcedure` — every authenticated tRPC procedure
 * gets a tenant-scoped `ctx.db` so even if a query omits `tenantId` in
 * its `where`, Postgres only ever sees `where: { ..., tenantId: <ctx> }`.
 *
 * What it does, by operation:
 *   - Reads (findFirst, findMany, count, aggregate, groupBy, ...): merge
 *     `tenantId` into `where`. Explicit `tenantId` in the call is
 *     *overridden* — the request's tenant always wins.
 *   - Writes by-where (update, updateMany, delete, deleteMany): same.
 *   - create / createMany: merge `tenantId` into `data` (per row for
 *     createMany).
 *   - upsert: merge into both `where` and `create`.
 *   - findUnique / findUniqueOrThrow: BLOCKED with a clear error.
 *     Prisma's unique-key shape doesn't allow safely merging `tenantId`
 *     unless the unique key already includes it. Callers must use
 *     `findFirst` with explicit `tenantId`. The extension takes it from
 *     there.
 *
 * NOT scoped:
 *   - `Tenant` model (the table doesn't have `tenantId` — it IS the tenant).
 *   - `AuditLog` (intentionally cross-tenant — used by platform admin).
 *   - Raw SQL (`$executeRaw`, `$queryRaw`) — Prisma extensions can't
 *     intercept these. The handful of raw queries in this codebase
 *     should filter by tenant explicitly.
 *
 * Callers that need cross-tenant access (platform admin REST routes,
 * crons, the initial auth lookup in `createTRPCContext`) import the
 * raw `db` from `@/server/db` directly — they don't go through this.
 */

const TENANT_SCOPED_MODELS = new Set<string>([
  "School",
  "User",
  "ClassSession",
  "Enrollment",
  "Notification",
  "StudentCourse",
  "Exam",
  "PushSubscription",
  "ConsentRecord",
]);

// Operations whose `where` we merge tenantId into.
const WHERE_MERGE_OPS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
]);

// findUnique can't be safely scoped — it would either require a
// compound unique key on (id, tenantId) for every model, or a post-fetch
// tenantId check which is brittle when callers use `select`. Forbid it
// instead and migrate callers to findFirst.
const FORBIDDEN_OPS = new Set(["findUnique", "findUniqueOrThrow"]);

export function withTenant(db: PrismaClient, tenantId: string) {
  return db.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_SCOPED_MODELS.has(model)) {
            return query(args);
          }

          if (FORBIDDEN_OPS.has(operation)) {
            throw new Error(
              `tenant-scope: ${operation} is forbidden on tenant-scoped model ${model}. Use findFirst with explicit tenantId.`,
            );
          }

          // Reads + write-by-where: merge tenantId into where
          if (WHERE_MERGE_OPS.has(operation)) {
            const a = args as { where?: Record<string, unknown> };
            a.where = { ...(a.where ?? {}), tenantId };
            return query(args);
          }

          if (operation === "create") {
            const a = args as { data: Record<string, unknown> };
            a.data = { ...a.data, tenantId };
            return query(args);
          }

          if (operation === "createMany" || operation === "createManyAndReturn") {
            const a = args as { data: Record<string, unknown> | Record<string, unknown>[] };
            const rows = Array.isArray(a.data) ? a.data : [a.data];
            a.data = rows.map((row) => ({ ...row, tenantId }));
            return query(args);
          }

          if (operation === "upsert") {
            const a = args as {
              where: Record<string, unknown>;
              create: Record<string, unknown>;
            };
            a.where = { ...a.where, tenantId };
            a.create = { ...a.create, tenantId };
            return query(args);
          }

          // Any unhandled operation: pass through. New Prisma ops can be
          // added here; we deliberately fail-open rather than fail-closed
          // so that minor library upgrades don't break the app silently.
          return query(args);
        },
      },
    },
  });
}

export type TenantScopedDb = ReturnType<typeof withTenant>;

/**
 * Either the raw Prisma client OR a tenant-scoped one. Helper functions
 * that accept a `db` parameter and are called from BOTH places (e.g.
 * notifications, audit log) should use this type so they accept either.
 */
export type DbClient = PrismaClient | TenantScopedDb;

// Re-export the Prisma namespace for callers that need its types.
export { Prisma };

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { db } from "./db";
import { withTenant } from "./lib/tenant-scope";
import { createClient } from "@/lib/supabase/server";
import { extractSubdomain } from "@/lib/subdomain";
import type { UserRole } from "@/generated/prisma/enums";

export type TRPCContext = {
  db: typeof db;
  tenantId: string | null;
  ip: string | null;
  // Global identity only. The caller's per-tenant role/school are resolved
  // from their Membership in `protectedProcedure` (see `ctx.membership`).
  user: { id: string } | null;
};

export const createTRPCContext = async (opts: {
  headers: Headers;
}): Promise<TRPCContext> => {
  const ip = opts.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return { db, tenantId: null, ip, user: null };
  }

  // Tenant is resolved from the subdomain — "which school's site is this".
  // Middleware doesn't run for /api/*, so `x-tenant-subdomain` is never set for
  // tRPC calls; derive it from the request Host instead. Access within the
  // tenant is then gated by the caller's Membership in `protectedProcedure`.
  const host = opts.headers.get("x-forwarded-host") ?? opts.headers.get("host");
  const subdomain = extractSubdomain(host);

  let tenantId: string | null = null;
  if (subdomain) {
    const school = await db.school.findUnique({
      where: { subdomain },
      select: { tenantId: true },
    });
    tenantId = school?.tenantId ?? null;
  }

  return { db, tenantId, ip, user: { id: authUser.id } };
};

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  // Expected errors are thrown as `new TRPCError({ message: "<i18n key>" })`,
  // so their `message` is safe to ship to the client. Unexpected throws
  // (Prisma, Supabase, JS) come through as INTERNAL_SERVER_ERROR with raw
  // messages that can leak table/column names — scrub those on the wire.
  // `onError` in the route handler still receives the original error, so
  // Sentry keeps the full detail for debugging.
  errorFormatter({ shape, error }) {
    if (process.env.NODE_ENV !== "production") return shape;
    if (error.code === "INTERNAL_SERVER_ERROR") {
      return {
        ...shape,
        message: "errors.unexpected",
        data: { ...shape.data, message: "errors.unexpected" },
      };
    }
    return shape;
  },
});

export const createCallerFactory = t.createCallerFactory;
export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Protected procedure — requires authentication.
 * All business logic endpoints should use this.
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user || !ctx.tenantId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "auth.notAuthenticated",
    });
  }

  // Replace ctx.db with a tenant-scoped client — every query against a
  // tenant-scoped model automatically carries the request's tenantId,
  // even if the procedure forgets to filter on it. See `tenant-scope.ts`.
  const db = withTenant(ctx.db, ctx.tenantId);

  // Approach 1a (cross-tenant identity): the caller's role + school live on their
  // Membership in THIS tenant, and it is authoritative — no membership ⇒ not a
  // member of this school ⇒ unauthorized (don't leak the tenant's existence).
  // Every user-creation path creates a membership, and existing users were
  // backfilled, so a missing one genuinely means "not a member here".
  const membership = await db.membership.findFirst({
    where: { userId: ctx.user.id, tenantId: ctx.tenantId },
    select: { role: true, schoolId: true, tenantId: true, status: true },
  });
  // No membership ⇒ not a member here. INACTIVE membership ⇒ deactivated in
  // this tenant (per-tenant status; a person may stay ACTIVE elsewhere). Both
  // are unauthorized — don't leak the tenant's existence.
  if (!membership || membership.status !== "ACTIVE") {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "auth.notAuthenticated",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      tenantId: ctx.tenantId,
      db,
      membership,
    },
  });
});

/**
 * Role-restricted procedure factory.
 * Usage: roleProtectedProcedure(["ADMIN", "SECRETARY"])
 */
export const roleProtectedProcedure = (allowedRoles: UserRole[]) =>
  protectedProcedure.use(async ({ ctx, next }) => {
    if (!allowedRoles.includes(ctx.membership.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "auth.insufficientPermissions",
      });
    }

    return next({ ctx });
  });

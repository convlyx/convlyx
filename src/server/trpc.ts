import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { db } from "./db";
import { withTenant } from "./lib/tenant-scope";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/generated/prisma/enums";

export type TRPCContext = {
  db: typeof db;
  tenantId: string | null;
  ip: string | null;
  user: {
    id: string;
    role: UserRole;
    tenantId: string;
    schoolId: string;
  } | null;
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

  // Look up our User record (extends Supabase auth.users with tenant/role info)
  const user = await db.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      role: true,
      tenantId: true,
      schoolId: true,
      status: true,
      school: { select: { subdomain: true } },
    },
  });

  if (!user || user.status !== "ACTIVE") {
    return { db, tenantId: null, ip, user: null };
  }

  // Validate subdomain matches user's tenant (if subdomain is present)
  const subdomain = opts.headers.get("x-tenant-subdomain");
  if (subdomain && user.school.subdomain !== subdomain) {
    return { db, tenantId: null, ip, user: null };
  }

  return {
    db,
    tenantId: user.tenantId,
    ip,
    user: {
      id: user.id,
      role: user.role,
      tenantId: user.tenantId,
      schoolId: user.schoolId,
    },
  };
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
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      tenantId: ctx.tenantId,
      db: withTenant(ctx.db, ctx.tenantId),
    },
  });
});

/**
 * Role-restricted procedure factory.
 * Usage: roleProtectedProcedure(["ADMIN", "SECRETARY"])
 */
export const roleProtectedProcedure = (allowedRoles: UserRole[]) =>
  protectedProcedure.use(async ({ ctx, next }) => {
    if (!allowedRoles.includes(ctx.user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "auth.insufficientPermissions",
      });
    }

    return next({ ctx });
  });

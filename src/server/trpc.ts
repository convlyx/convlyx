import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { db } from "./db";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/generated/prisma/enums";

export type TRPCContext = {
  db: typeof db;
  tenantId: string | null;
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
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return { db, tenantId: null, user: null };
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
      tenant: { select: { subdomain: true } },
    },
  });

  if (!user || user.status !== "ACTIVE") {
    return { db, tenantId: null, user: null };
  }

  // Validate subdomain matches user's tenant (if subdomain is present)
  const subdomain = opts.headers.get("x-tenant-subdomain");
  if (subdomain && user.tenant.subdomain !== subdomain) {
    return { db, tenantId: null, user: null };
  }

  return {
    db,
    tenantId: user.tenantId,
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

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      tenantId: ctx.tenantId,
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

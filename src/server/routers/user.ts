import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createClient } from "@supabase/supabase-js";
import { router, protectedProcedure, roleProtectedProcedure } from "../trpc";
import { createUserSchema, updateUserSchema } from "@/lib/validations/user";

// Admin client for creating auth users
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export const userRouter = router({
  list: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(
      z.object({
        schoolId: z.string().uuid().optional(),
        role: z.enum(["ADMIN", "SECRETARY", "INSTRUCTOR", "STUDENT"]).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.user.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(input?.schoolId && { schoolId: input.schoolId }),
          ...(input?.role && { role: input.role }),
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
          school: { select: { id: true, name: true } },
        },
        orderBy: { name: "asc" },
      });
    }),

  getById: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.user.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          schoolId: true,
          school: { select: { id: true, name: true } },
          createdAt: true,
        },
      });
    }),

  create: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(createUserSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify the school belongs to this tenant
      const school = await ctx.db.school.findFirst({
        where: { id: input.schoolId, tenantId: ctx.tenantId },
        select: { id: true },
      });

      if (!school) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "classes.schoolNotFound",
        });
      }

      // Create Supabase auth user
      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: input.email,
          password: input.password,
          email_confirm: true,
        });

      if (authError) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: authError.message,
        });
      }

      // Create Prisma user profile
      const user = await ctx.db.user.create({
        data: {
          id: authData.user.id,
          tenantId: ctx.tenantId,
          schoolId: input.schoolId,
          email: input.email,
          name: input.name,
          role: input.role,
        },
        select: { id: true, name: true, email: true, role: true },
      });

      return user;
    }),

  update: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(updateUserSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify the school belongs to this tenant
      const school = await ctx.db.school.findFirst({
        where: { id: input.schoolId, tenantId: ctx.tenantId },
        select: { id: true },
      });

      if (!school) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "classes.schoolNotFound",
        });
      }

      return ctx.db.user.updateMany({
        where: { id: input.id, tenantId: ctx.tenantId },
        data: {
          name: input.name,
          role: input.role,
          schoolId: input.schoolId,
        },
      });
    }),

  deactivate: roleProtectedProcedure(["ADMIN"])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "user.cannotDeactivateSelf",
        });
      }

      return ctx.db.user.updateMany({
        where: { id: input.id, tenantId: ctx.tenantId },
        data: { status: "INACTIVE" },
      });
    }),

  activate: roleProtectedProcedure(["ADMIN"])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.updateMany({
        where: { id: input.id, tenantId: ctx.tenantId },
        data: { status: "ACTIVE" },
      });
    }),
});

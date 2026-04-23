import { z } from "zod/v4";
import { router, protectedProcedure, roleProtectedProcedure } from "../trpc";
import { createSchoolSchema, updateSchoolSchema } from "@/lib/validations/school";

export const schoolRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.school.findMany({
      where: { tenantId: ctx.tenantId },
      select: {
        id: true,
        name: true,
        subdomain: true,
        address: true,
        phone: true,
        createdAt: true,
        _count: { select: { users: true, sessions: true } },
      },
      orderBy: { name: "asc" },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.school.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: {
          id: true,
          name: true,
          subdomain: true,
          address: true,
          phone: true,
          createdAt: true,
        },
      });
    }),

  create: roleProtectedProcedure(["ADMIN"])
    .input(createSchoolSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.school.create({
        data: {
          tenantId: ctx.tenantId,
          name: input.name,
          subdomain: input.subdomain,
          address: input.address,
          phone: input.phone,
        },
        select: { id: true, name: true },
      });
    }),

  updateTenant: roleProtectedProcedure(["ADMIN"])
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.tenant.update({
        where: { id: ctx.tenantId },
        data: { name: input.name },
      });
      return { success: true };
    }),

  update: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(updateSchoolSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.school.updateMany({
        where: { id: input.id, tenantId: ctx.tenantId },
        data: {
          name: input.name,
          address: input.address,
          phone: input.phone,
        },
      });
    }),
});

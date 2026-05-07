import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, roleProtectedProcedure } from "../trpc";
import {
  startCourseSchema,
  completeCourseSchema,
  abandonCourseSchema,
} from "@/lib/validations/course";

export const courseRouter = router({
  /** All courses for a given student (history + current). */
  listByStudent: protectedProcedure
    .input(z.object({ studentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Students can only see their own courses
      if (ctx.user.role === "STUDENT" && ctx.user.id !== input.studentId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "auth.insufficientPermissions",
        });
      }

      return ctx.db.studentCourse.findMany({
        where: { tenantId: ctx.tenantId, studentId: input.studentId },
        select: {
          id: true,
          category: true,
          status: true,
          startedAt: true,
          completedAt: true,
          exams: {
            select: {
              id: true,
              type: true,
              scheduledAt: true,
              result: true,
            },
            orderBy: { scheduledAt: "desc" },
          },
        },
        orderBy: { startedAt: "desc" },
      });
    }),

  /** Currently in-progress course for a student (or null). */
  currentForStudent: protectedProcedure
    .input(z.object({ studentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role === "STUDENT" && ctx.user.id !== input.studentId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "auth.insufficientPermissions",
        });
      }

      return ctx.db.studentCourse.findFirst({
        where: {
          tenantId: ctx.tenantId,
          studentId: input.studentId,
          status: "IN_PROGRESS",
        },
        select: {
          id: true,
          category: true,
          startedAt: true,
        },
      });
    }),

  /** Start a new course. A student may have multiple in-progress courses
   *  (e.g. A + B), but not two active for the same category. */
  start: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(startCourseSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify student belongs to tenant and is actually a student
      const student = await ctx.db.user.findFirst({
        where: {
          id: input.studentId,
          tenantId: ctx.tenantId,
          role: "STUDENT",
        },
        select: { id: true, schoolId: true },
      });

      if (!student) {
        throw new TRPCError({ code: "NOT_FOUND", message: "users.notFound" });
      }

      // Reject only if there's already an in-progress course for the same
      // category — different categories can run in parallel.
      const existing = await ctx.db.studentCourse.findFirst({
        where: {
          tenantId: ctx.tenantId,
          studentId: input.studentId,
          category: input.category,
          status: "IN_PROGRESS",
        },
        select: { id: true },
      });

      if (existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "courses.alreadyHasActiveForCategory",
        });
      }

      return ctx.db.studentCourse.create({
        data: {
          tenantId: ctx.tenantId,
          schoolId: student.schoolId,
          studentId: input.studentId,
          category: input.category,
        },
        select: { id: true, category: true },
      });
    }),

  complete: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(completeCourseSchema)
    .mutation(async ({ ctx, input }) => {
      const course = await ctx.db.studentCourse.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: { status: true },
      });

      if (!course) {
        throw new TRPCError({ code: "NOT_FOUND", message: "courses.notFound" });
      }

      if (course.status !== "IN_PROGRESS") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "courses.notActive",
        });
      }

      return ctx.db.studentCourse.update({
        where: { id: input.id },
        data: { status: "COMPLETED", completedAt: new Date() },
        select: { id: true },
      });
    }),

  abandon: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(abandonCourseSchema)
    .mutation(async ({ ctx, input }) => {
      const course = await ctx.db.studentCourse.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: { status: true },
      });

      if (!course) {
        throw new TRPCError({ code: "NOT_FOUND", message: "courses.notFound" });
      }

      if (course.status !== "IN_PROGRESS") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "courses.notActive",
        });
      }

      return ctx.db.studentCourse.update({
        where: { id: input.id },
        data: { status: "ABANDONED", completedAt: new Date() },
        select: { id: true },
      });
    }),
});

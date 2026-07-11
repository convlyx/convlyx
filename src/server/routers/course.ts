import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, roleProtectedProcedure } from "../trpc";
import {
  startCourseSchema,
  completeCourseSchema,
  abandonCourseSchema,
} from "@/lib/validations/course";
import { recordNotification, dispatchPush, type PushJob } from "../lib/notifications";

export const courseRouter = router({
  /** All courses for a given student (history + current). */
  listByStudent: protectedProcedure
    .input(z.object({ studentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Students can only see their own courses
      if (ctx.membership.role === "STUDENT" && ctx.user.id !== input.studentId) {
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
      if (ctx.membership.role === "STUDENT" && ctx.user.id !== input.studentId) {
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
      // Verify student belongs to tenant and is actually a student (role +
      // school are per-tenant → read from the Membership).
      const student = await ctx.db.membership.findFirst({
        where: {
          userId: input.studentId,
          tenantId: ctx.tenantId,
          role: "STUDENT",
        },
        select: { schoolId: true },
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
        select: { status: true, studentId: true, category: true },
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

      const now = new Date();

      // Theory classes are category-agnostic — only cancel theory enrollments
      // if the student has no other active course left to attend them for.
      const otherActiveCourses = await ctx.db.studentCourse.count({
        where: {
          tenantId: ctx.tenantId,
          studentId: course.studentId,
          status: "IN_PROGRESS",
          id: { not: input.id },
        },
      });

      const sessionMatch =
        otherActiveCourses === 0
          ? {
              OR: [
                { category: course.category },
                { classType: "THEORY" as const },
              ],
            }
          : { category: course.category };

      // Update course + cancel future enrollments in one transaction so we
      // don't leave the student in a "course abandoned but still enrolled
      // in future classes" half-state if the second update fails.
      const jobs: (PushJob | null)[] = [];
      const cancelledCount = await ctx.db.$transaction(async (tx) => {
        await tx.studentCourse.update({
          where: { id: input.id },
          data: { status: "ABANDONED", completedAt: now },
        });
        const cancelResult = await tx.enrollment.updateMany({
          where: {
            tenantId: ctx.tenantId,
            studentId: course.studentId,
            status: "ENROLLED",
            session: {
              startsAt: { gt: now },
              status: "SCHEDULED",
              ...sessionMatch,
            },
          },
          data: { status: "CANCELLED" },
        });
        const count = cancelResult.count;

        // Notify the student. Split by whether anything got cancelled, so the
        // server-side string substitution (which has no plural support) reads
        // naturally in either case.
        jobs.push(
          await recordNotification(tx, {
            tenantId: ctx.tenantId,
            userId: course.studentId,
            type: "course.abandoned",
            titleKey: "notifications.courseWasAbandoned",
            messageKey:
              count > 0
                ? "notifications.courseAbandonedWithCancellations"
                : "notifications.courseAbandoned",
            params: { category: course.category, count: String(count) },
          }),
        );

        return count;
      });
      dispatchPush(ctx.db, jobs);

      return { id: input.id, cancelledCount };
    }),
});

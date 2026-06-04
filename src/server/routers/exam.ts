import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, roleProtectedProcedure } from "../trpc";
import {
  scheduleExamSchema,
  updateExamSchema,
  recordExamResultSchema,
  cancelExamSchema,
} from "@/lib/validations/exam";
import { createNotification, formatClassTime } from "../lib/notifications";
import { hasInstructorScheduleConflict, hasStudentScheduleConflict } from "../lib/schedule-conflict";
import { logger } from "@/lib/logger";

// Exams occupy a 60-min slot starting at `scheduledAt` (UI convention).
const EXAM_DURATION_MS = 60 * 60 * 1000;

export const examRouter = router({
  /** List exams visible to the caller in a date range (used by calendar). */
  list: protectedProcedure
    .input(
      z
        .object({
          schoolId: z.string().uuid().optional(),
          from: z.string().datetime().optional(),
          to: z.string().datetime().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      // Students see only their own exams; instructors see exams they accompany.
      const roleFilter =
        ctx.user.role === "STUDENT"
          ? { course: { studentId: ctx.user.id } }
          : ctx.user.role === "INSTRUCTOR"
            ? { instructorId: ctx.user.id }
            : {};

      return ctx.db.exam.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...roleFilter,
          ...(input?.schoolId && { schoolId: input.schoolId }),
          ...(input?.from || input?.to
            ? {
                scheduledAt: {
                  ...(input?.from && { gte: new Date(input.from) }),
                  ...(input?.to && { lte: new Date(input.to) }),
                },
              }
            : {}),
        },
        select: {
          id: true,
          type: true,
          scheduledAt: true,
          location: true,
          result: true,
          course: {
            select: {
              id: true,
              category: true,
              student: { select: { id: true, name: true } },
            },
          },
          instructor: { select: { id: true, name: true } },
        },
        orderBy: { scheduledAt: "asc" },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const exam = await ctx.db.exam.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: {
          id: true,
          type: true,
          scheduledAt: true,
          location: true,
          result: true,
          examinerNotes: true,
          createdAt: true,
          updatedAt: true,
          course: {
            select: {
              id: true,
              category: true,
              student: { select: { id: true, name: true, email: true } },
            },
          },
          instructor: { select: { id: true, name: true } },
        },
      });

      if (!exam) {
        throw new TRPCError({ code: "NOT_FOUND", message: "exams.notFound" });
      }

      // Authorization: students can only view their own exams
      if (
        ctx.user.role === "STUDENT" &&
        exam.course.student.id !== ctx.user.id
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "auth.insufficientPermissions",
        });
      }

      return exam;
    }),

  schedule: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(scheduleExamSchema)
    .mutation(async ({ ctx, input }) => {
      const course = await ctx.db.studentCourse.findFirst({
        where: { id: input.courseId, tenantId: ctx.tenantId },
        select: {
          id: true,
          status: true,
          student: {
            select: { id: true, schoolId: true, school: { select: { timeZone: true } } },
          },
        },
      });

      if (!course) {
        throw new TRPCError({ code: "NOT_FOUND", message: "courses.notFound" });
      }

      if (course.status !== "IN_PROGRESS") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "exams.courseNotActive",
        });
      }

      // Reject if there's already a SCHEDULED or PASSED exam of this type on this course
      const blocking = await ctx.db.exam.findFirst({
        where: {
          courseId: course.id,
          type: input.type,
          result: { in: ["SCHEDULED", "PASSED"] },
        },
        select: { result: true },
      });
      if (blocking) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            blocking.result === "PASSED"
              ? "exams.alreadyPassed"
              : "exams.alreadyScheduled",
        });
      }

      // Practical exams require the theory exam for the same course to have
      // been passed first (IMT regulation — universal, not configurable).
      if (input.type === "PRACTICAL") {
        const theoryPassed = await ctx.db.exam.findFirst({
          where: {
            courseId: course.id,
            type: "THEORY",
            result: "PASSED",
          },
          select: { id: true },
        });
        if (!theoryPassed) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "exams.theoryNotPassed",
          });
        }
      }

      // Verify accompanying instructor (if provided) belongs to this tenant
      if (input.instructorId) {
        const instructor = await ctx.db.user.findFirst({
          where: {
            id: input.instructorId,
            tenantId: ctx.tenantId,
            role: "INSTRUCTOR",
            status: "ACTIVE",
          },
          select: { id: true },
        });
        if (!instructor) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "classes.instructorNotFound",
          });
        }

        // Refuse if the instructor is already booked (class OR another exam)
        // during this exam's 60-min slot.
        const scheduledAt = new Date(input.scheduledAt);
        const conflict = await hasInstructorScheduleConflict({
          db: ctx.db,
          tenantId: ctx.tenantId,
          instructorId: input.instructorId,
          windows: [{
            startsAt: scheduledAt,
            endsAt: new Date(scheduledAt.getTime() + EXAM_DURATION_MS),
          }],
        });
        if (conflict) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "exams.scheduleConflict",
          });
        }
      }

      // The student can't be double-booked either: reject if they already have
      // a class or another scheduled exam overlapping this exam's 60-min slot.
      const examStartsAt = new Date(input.scheduledAt);
      const studentConflict = await hasStudentScheduleConflict({
        db: ctx.db,
        tenantId: ctx.tenantId,
        studentIds: [course.student.id],
        windows: [{ startsAt: examStartsAt, endsAt: new Date(examStartsAt.getTime() + EXAM_DURATION_MS) }],
      });
      if (studentConflict) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "exams.studentScheduleConflict",
        });
      }

      const exam = await ctx.db.exam.create({
        data: {
          tenantId: ctx.tenantId,
          schoolId: course.student.schoolId,
          courseId: course.id,
          type: input.type,
          scheduledAt: new Date(input.scheduledAt),
          location: input.location,
          instructorId: input.instructorId,
          createdById: ctx.user.id,
          updatedById: ctx.user.id,
        },
        select: {
          id: true,
          type: true,
          scheduledAt: true,
          course: {
            select: { student: { select: { id: true, name: true } } },
          },
        },
      });

      const timeStr = formatClassTime(exam.scheduledAt, course.student.school.timeZone);

      // Notify student
      createNotification({
        db: ctx.db,
        tenantId: ctx.tenantId,
        userId: course.student.id,
        type: "exam.scheduled",
        titleKey:
          exam.type === "THEORY"
            ? "notifications.theoryExamScheduledTitle"
            : "notifications.practicalExamScheduledTitle",
        messageKey:
          exam.type === "THEORY"
            ? "notifications.theoryExamScheduledMessage"
            : "notifications.practicalExamScheduledMessage",
        params: { time: timeStr },
      }).catch((e) => logger.warn("notification dispatch failed", { error: e }));

      // Notify accompanying instructor if any
      if (input.instructorId) {
        createNotification({
          db: ctx.db,
          tenantId: ctx.tenantId,
          userId: input.instructorId,
          type: "exam.scheduled",
          titleKey: "notifications.examAccompanyTitle",
          messageKey: "notifications.examAccompanyMessage",
          params: { student: exam.course.student.name, time: timeStr },
        }).catch((e) => logger.warn("notification dispatch failed", { error: e }));
      }

      return exam;
    }),

  update: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(updateExamSchema)
    .mutation(async ({ ctx, input }) => {
      const exam = await ctx.db.exam.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: { id: true, result: true, course: { select: { studentId: true } } },
      });

      if (!exam) {
        throw new TRPCError({ code: "NOT_FOUND", message: "exams.notFound" });
      }

      if (exam.result !== "SCHEDULED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "exams.cannotEditCompleted",
        });
      }

      if (input.instructorId) {
        const instructor = await ctx.db.user.findFirst({
          where: {
            id: input.instructorId,
            tenantId: ctx.tenantId,
            role: "INSTRUCTOR",
            status: "ACTIVE",
          },
          select: { id: true },
        });
        if (!instructor) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "classes.instructorNotFound",
          });
        }

        // Conflict check, excluding the exam being updated.
        const scheduledAt = new Date(input.scheduledAt);
        const conflict = await hasInstructorScheduleConflict({
          db: ctx.db,
          tenantId: ctx.tenantId,
          instructorId: input.instructorId,
          windows: [{
            startsAt: scheduledAt,
            endsAt: new Date(scheduledAt.getTime() + EXAM_DURATION_MS),
          }],
          excludeExamId: input.id,
        });
        if (conflict) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "exams.scheduleConflict",
          });
        }
      }

      // Keep the student free at the new time too, excluding this exam.
      const examStartsAt = new Date(input.scheduledAt);
      const studentConflict = await hasStudentScheduleConflict({
        db: ctx.db,
        tenantId: ctx.tenantId,
        studentIds: [exam.course.studentId],
        windows: [{ startsAt: examStartsAt, endsAt: new Date(examStartsAt.getTime() + EXAM_DURATION_MS) }],
        excludeExamId: input.id,
      });
      if (studentConflict) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "exams.studentScheduleConflict",
        });
      }

      return ctx.db.exam.update({
        where: { id: input.id },
        data: {
          scheduledAt: new Date(input.scheduledAt),
          location: input.location,
          instructorId: input.instructorId ?? null,
          updatedById: ctx.user.id,
        },
        select: { id: true },
      });
    }),

  recordResult: roleProtectedProcedure(["ADMIN", "SECRETARY", "INSTRUCTOR"])
    .input(recordExamResultSchema)
    .mutation(async ({ ctx, input }) => {
      const exam = await ctx.db.exam.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: {
          id: true,
          result: true,
          instructorId: true,
          type: true,
          scheduledAt: true,
          course: {
            select: { student: { select: { id: true } } },
          },
        },
      });

      if (!exam) {
        throw new TRPCError({ code: "NOT_FOUND", message: "exams.notFound" });
      }

      // Instructors can only mark NO_SHOW on exams they accompany
      if (ctx.user.role === "INSTRUCTOR") {
        if (input.result !== "NO_SHOW") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "auth.insufficientPermissions",
          });
        }
        if (exam.instructorId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "auth.insufficientPermissions",
          });
        }
      }

      if (exam.result !== "SCHEDULED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "exams.resultAlreadyRecorded",
        });
      }

      const updated = await ctx.db.exam.update({
        where: { id: input.id },
        data: {
          result: input.result,
          examinerNotes: input.examinerNotes,
          updatedById: ctx.user.id,
        },
        select: { id: true, type: true, result: true },
      });

      // Notify student of result
      const titleKey =
        input.result === "PASSED"
          ? "notifications.examPassedTitle"
          : input.result === "FAILED"
            ? "notifications.examFailedTitle"
            : "notifications.examResultTitle";
      const messageKey =
        input.result === "PASSED"
          ? "notifications.examPassedMessage"
          : input.result === "FAILED"
            ? "notifications.examFailedMessage"
            : "notifications.examResultMessage";

      createNotification({
        db: ctx.db,
        tenantId: ctx.tenantId,
        userId: exam.course.student.id,
        type: "exam.result",
        titleKey,
        messageKey,
        params: {
          examType:
            exam.type === "THEORY"
              ? "teórico"
              : "prático",
        },
      }).catch((e) => logger.warn("notification dispatch failed", { error: e }));

      return updated;
    }),

  cancel: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(cancelExamSchema)
    .mutation(async ({ ctx, input }) => {
      const exam = await ctx.db.exam.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: {
          id: true,
          result: true,
          type: true,
          scheduledAt: true,
          instructorId: true,
          course: { select: { student: { select: { id: true, school: { select: { timeZone: true } } } } } },
        },
      });

      if (!exam) {
        throw new TRPCError({ code: "NOT_FOUND", message: "exams.notFound" });
      }

      if (exam.result !== "SCHEDULED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "exams.cannotCancelCompleted",
        });
      }

      const updated = await ctx.db.exam.update({
        where: { id: input.id },
        data: { result: "CANCELLED", updatedById: ctx.user.id },
        select: { id: true },
      });

      const timeStr = formatClassTime(exam.scheduledAt, exam.course.student.school.timeZone);

      createNotification({
        db: ctx.db,
        tenantId: ctx.tenantId,
        userId: exam.course.student.id,
        type: "exam.cancelled",
        titleKey: "notifications.examCancelledTitle",
        messageKey: "notifications.examCancelledMessage",
        params: { time: timeStr },
      }).catch((e) => logger.warn("notification dispatch failed", { error: e }));

      if (exam.instructorId) {
        createNotification({
          db: ctx.db,
          tenantId: ctx.tenantId,
          userId: exam.instructorId,
          type: "exam.cancelled",
          titleKey: "notifications.examCancelledTitle",
          messageKey: "notifications.examCancelledInstructorMessage",
          params: { time: timeStr },
        }).catch((e) => logger.warn("notification dispatch failed", { error: e }));
      }

      return updated;
    }),
});

import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, roleProtectedProcedure } from "../trpc";
import {
  scheduleExamSchema,
  updateExamSchema,
  recordExamResultSchema,
  cancelExamSchema,
} from "@/lib/validations/exam";
import { recordNotification, dispatchPush, formatClassTime, type PushJob } from "../lib/notifications";
import { hasInstructorScheduleConflict, hasStudentScheduleConflict } from "../lib/schedule-conflict";
import { userNameSelect, tenantName } from "../lib/tenant-name";

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
        ctx.membership.role === "STUDENT"
          ? { course: { studentId: ctx.user.id } }
          : ctx.membership.role === "INSTRUCTOR"
            ? { instructorId: ctx.user.id }
            : {};

      const rows = await ctx.db.exam.findMany({
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
              student: { select: { id: true, ...userNameSelect(ctx.tenantId) } },
            },
          },
          instructor: { select: { id: true, ...userNameSelect(ctx.tenantId) } },
        },
        orderBy: { scheduledAt: "asc" },
      });

      return rows.map((e) => ({
        ...e,
        course: {
          ...e.course,
          student: { id: e.course.student.id, name: tenantName(e.course.student) },
        },
        instructor: e.instructor
          ? { id: e.instructor.id, name: tenantName(e.instructor) }
          : null,
      }));
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
              student: { select: { id: true, email: true, ...userNameSelect(ctx.tenantId) } },
            },
          },
          instructor: { select: { id: true, ...userNameSelect(ctx.tenantId) } },
        },
      });

      if (!exam) {
        throw new TRPCError({ code: "NOT_FOUND", message: "exams.notFound" });
      }

      // Authorization: students can only view their own exams
      if (
        ctx.membership.role === "STUDENT" &&
        exam.course.student.id !== ctx.user.id
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "auth.insufficientPermissions",
        });
      }

      return {
        ...exam,
        course: {
          ...exam.course,
          student: {
            id: exam.course.student.id,
            email: exam.course.student.email,
            name: tenantName(exam.course.student),
          },
        },
        instructor: exam.instructor
          ? { id: exam.instructor.id, name: tenantName(exam.instructor) }
          : null,
      };
    }),

  schedule: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(scheduleExamSchema)
    .mutation(async ({ ctx, input }) => {
      const course = await ctx.db.studentCourse.findFirst({
        where: { id: input.courseId, tenantId: ctx.tenantId },
        select: {
          id: true,
          status: true,
          schoolId: true,
          school: { select: { timeZone: true } },
          student: { select: { id: true } },
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
        const instructor = await ctx.db.membership.findFirst({
          where: {
            userId: input.instructorId,
            tenantId: ctx.tenantId,
            role: "INSTRUCTOR",
            status: "ACTIVE",
          },
          select: { userId: true },
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

      const jobs: (PushJob | null)[] = [];
      const exam = await ctx.db.$transaction(async (tx) => {
        const created = await tx.exam.create({
          data: {
            tenantId: ctx.tenantId,
            schoolId: course.schoolId,
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
              select: { student: { select: { id: true, ...userNameSelect(ctx.tenantId) } } },
            },
          },
        });

        const timeStr = formatClassTime(created.scheduledAt, course.school.timeZone);

        // Notify student
        jobs.push(
          await recordNotification(tx, {
            tenantId: ctx.tenantId,
            userId: course.student.id,
            type: "exam.scheduled",
            titleKey:
              created.type === "THEORY"
                ? "notifications.theoryExamScheduledTitle"
                : "notifications.practicalExamScheduledTitle",
            messageKey:
              created.type === "THEORY"
                ? "notifications.theoryExamScheduledMessage"
                : "notifications.practicalExamScheduledMessage",
            params: { time: timeStr },
          }),
        );

        // Notify accompanying instructor if any
        if (input.instructorId) {
          jobs.push(
            await recordNotification(tx, {
              tenantId: ctx.tenantId,
              userId: input.instructorId,
              type: "exam.scheduled",
              titleKey: "notifications.examAccompanyTitle",
              messageKey: "notifications.examAccompanyMessage",
              params: { student: tenantName(created.course.student), time: timeStr },
            }),
          );
        }

        return created;
      });
      dispatchPush(ctx.db, jobs);

      return {
        ...exam,
        course: {
          ...exam.course,
          student: { id: exam.course.student.id, name: tenantName(exam.course.student) },
        },
      };
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
        const instructor = await ctx.db.membership.findFirst({
          where: {
            userId: input.instructorId,
            tenantId: ctx.tenantId,
            role: "INSTRUCTOR",
            status: "ACTIVE",
          },
          select: { userId: true },
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
      if (ctx.membership.role === "INSTRUCTOR") {
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

      const jobs: (PushJob | null)[] = [];
      const updated = await ctx.db.$transaction(async (tx) => {
        const updatedExam = await tx.exam.update({
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

        jobs.push(
          await recordNotification(tx, {
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
          }),
        );

        return updatedExam;
      });
      dispatchPush(ctx.db, jobs);

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
          course: { select: { school: { select: { timeZone: true } }, student: { select: { id: true } } } },
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

      const jobs: (PushJob | null)[] = [];
      const updated = await ctx.db.$transaction(async (tx) => {
        const updatedExam = await tx.exam.update({
          where: { id: input.id },
          data: { result: "CANCELLED", updatedById: ctx.user.id },
          select: { id: true },
        });

        const timeStr = formatClassTime(exam.scheduledAt, exam.course.school.timeZone);

        jobs.push(
          await recordNotification(tx, {
            tenantId: ctx.tenantId,
            userId: exam.course.student.id,
            type: "exam.cancelled",
            titleKey: "notifications.examCancelledTitle",
            messageKey: "notifications.examCancelledMessage",
            params: { time: timeStr },
          }),
        );

        if (exam.instructorId) {
          jobs.push(
            await recordNotification(tx, {
              tenantId: ctx.tenantId,
              userId: exam.instructorId,
              type: "exam.cancelled",
              titleKey: "notifications.examCancelledTitle",
              messageKey: "notifications.examCancelledInstructorMessage",
              params: { time: timeStr },
            }),
          );
        }

        return updatedExam;
      });
      dispatchPush(ctx.db, jobs);

      return updated;
    }),
});

import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, roleProtectedProcedure } from "../trpc";
import { createNotification, formatClassTime } from "../lib/notifications";

export const enrollmentRouter = router({
  /** Enroll a student in a class session */
  enroll: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        studentId: z.string().uuid().optional(), // Admin/secretary can enroll others
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Students can only enroll themselves
      const studentId =
        ctx.user.role === "STUDENT" ? ctx.user.id : (input.studentId ?? ctx.user.id);

      if (ctx.user.role === "STUDENT" && input.studentId && input.studentId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "auth.insufficientPermissions",
        });
      }

      // Verify the session exists, is in this tenant, and is scheduled
      const session = await ctx.db.classSession.findFirst({
        where: { id: input.sessionId, tenantId: ctx.tenantId },
        select: {
          id: true,
          title: true,
          startsAt: true,
          capacity: true,
          status: true,
          _count: {
            select: {
              enrollments: { where: { status: "ENROLLED" } },
            },
          },
        },
      });

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "classes.notFound" });
      }

      // Verify student belongs to this tenant (when enrolling someone else)
      if (studentId !== ctx.user.id) {
        const student = await ctx.db.user.findFirst({
          where: { id: studentId, tenantId: ctx.tenantId, role: "STUDENT", status: "ACTIVE" },
          select: { id: true },
        });
        if (!student) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "user.notFound" });
        }
      }

      if (session.status !== "SCHEDULED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "enrollment.classNotAvailable",
        });
      }

      if (session._count.enrollments >= session.capacity) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "enrollment.classFull",
        });
      }

      // Check student is not already enrolled
      const existing = await ctx.db.enrollment.findUnique({
        where: {
          sessionId_studentId: {
            sessionId: input.sessionId,
            studentId,
          },
        },
        select: { id: true, status: true },
      });

      if (existing?.status === "ENROLLED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "enrollment.alreadyEnrolled",
        });
      }

      // If previously cancelled, re-enroll
      if (existing) {
        const result = await ctx.db.enrollment.update({
          where: { id: existing.id },
          data: { status: "ENROLLED" },
          select: { id: true, status: true },
        });

        // Notify student if enrolled by someone else
        if (studentId !== ctx.user.id) {
          createNotification({
            db: ctx.db,
            tenantId: ctx.tenantId,
            userId: studentId,
            type: "enrollment.created",
            titleKey: "notifications.enrollmentWasConfirmed",
            messageKey: "notifications.classAssigned",
            params: { title: session.title, time: formatClassTime(new Date(session.startsAt)) },
          }).catch(() => {});
        }

        return result;
      }

      const result = await ctx.db.enrollment.create({
        data: {
          tenantId: ctx.tenantId,
          sessionId: input.sessionId,
          studentId,
        },
        select: { id: true, status: true },
      });

      // Notify student if enrolled by someone else
      if (studentId !== ctx.user.id) {
        createNotification({
          db: ctx.db,
          tenantId: ctx.tenantId,
          userId: studentId,
          type: "enrollment.created",
          titleKey: "notifications.enrollmentWasConfirmed",
          messageKey: "notifications.classAssigned",
          params: { title: session.title, time: formatClassTime(new Date(session.startsAt)) },
        }).catch(() => {});
      }

      return result;
    }),

  /** Cancel an enrollment */
  cancel: protectedProcedure
    .input(z.object({ enrollmentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const enrollment = await ctx.db.enrollment.findFirst({
        where: {
          id: input.enrollmentId,
          tenantId: ctx.tenantId,
        },
        select: {
          id: true,
          studentId: true,
          status: true,
          session: { select: { id: true, title: true, startsAt: true } },
        },
      });

      if (!enrollment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "enrollment.notFound" });
      }

      // Students can only cancel their own
      if (ctx.user.role === "STUDENT" && enrollment.studentId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "auth.insufficientPermissions",
        });
      }

      if (enrollment.status !== "ENROLLED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "enrollment.notActive",
        });
      }

      const result = await ctx.db.enrollment.update({
        where: { id: input.enrollmentId },
        data: { status: "CANCELLED" },
        select: { id: true, status: true },
      });

      // Notify student if cancelled by admin/secretary (not self-cancellation)
      if (enrollment.studentId !== ctx.user.id) {
        createNotification({
          db: ctx.db,
          tenantId: ctx.tenantId,
          userId: enrollment.studentId,
          type: "enrollment.cancelled",
          titleKey: "notifications.enrollmentWasCancelled",
          messageKey: "notifications.enrollmentCancelled",
          params: { title: enrollment.session.title, time: formatClassTime(new Date(enrollment.session.startsAt)) },
        }).catch(() => {});
      }

      return result;
    }),

  /** Mark attendance (instructor, secretary, admin) */
  markAttendance: roleProtectedProcedure(["ADMIN", "SECRETARY", "INSTRUCTOR"])
    .input(
      z.object({
        enrollmentId: z.string().uuid(),
        status: z.enum(["ATTENDED", "NO_SHOW"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const enrollment = await ctx.db.enrollment.findFirst({
        where: {
          id: input.enrollmentId,
          tenantId: ctx.tenantId,
          status: "ENROLLED",
        },
        select: {
          id: true,
          studentId: true,
          session: { select: { id: true, title: true, startsAt: true } },
        },
      });

      if (!enrollment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "enrollment.notFound" });
      }

      const result = await ctx.db.enrollment.update({
        where: { id: input.enrollmentId },
        data: { status: input.status },
        select: { id: true, status: true },
      });

      // Notify student about attendance
      const timeStr = formatClassTime(new Date(enrollment.session.startsAt));
      createNotification({
        db: ctx.db,
        tenantId: ctx.tenantId,
        userId: enrollment.studentId,
        type: "enrollment.attendance",
        titleKey: "notifications.attendanceWasRecorded",
        messageKey: "notifications.attendanceMarked",
        params: { title: enrollment.session.title, time: timeStr, status: input.status },
      }).catch(() => {});

      return result;
    }),

  /** Add or update instructor notes on an enrollment */
  addNote: roleProtectedProcedure(["INSTRUCTOR"])
    .input(z.object({
      enrollmentId: z.string().uuid(),
      notes: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const enrollment = await ctx.db.enrollment.findFirst({
        where: { id: input.enrollmentId, tenantId: ctx.tenantId },
        select: { id: true },
      });

      if (!enrollment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "enrollment.notFound" });
      }

      await ctx.db.enrollment.update({
        where: { id: input.enrollmentId },
        data: { notes: input.notes },
      });

      return { success: true };
    }),

  /** Bulk mark attendance for all enrolled students in a session */
  bulkMarkAttendance: roleProtectedProcedure(["ADMIN", "SECRETARY", "INSTRUCTOR"])
    .input(z.object({
      sessionId: z.string().uuid(),
      status: z.enum(["ATTENDED", "NO_SHOW"]),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify session belongs to tenant
      const session = await ctx.db.classSession.findFirst({
        where: { id: input.sessionId, tenantId: ctx.tenantId },
        select: { id: true },
      });

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "classes.notFound" });
      }

      const result = await ctx.db.enrollment.updateMany({
        where: {
          sessionId: input.sessionId,
          tenantId: ctx.tenantId,
          status: "ENROLLED",
        },
        data: { status: input.status },
      });

      return { count: result.count };
    }),

  /** List enrollments for a student (own) or all (admin/secretary) */
  listByStudent: protectedProcedure
    .input(z.object({ studentId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const studentId =
        ctx.user.role === "STUDENT" ? ctx.user.id : input?.studentId;

      return ctx.db.enrollment.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(studentId && { studentId }),
        },
        select: {
          id: true,
          status: true,
          enrolledAt: true,
          session: {
            select: {
              id: true,
              title: true,
              classType: true,
              startsAt: true,
              endsAt: true,
              status: true,
              instructor: { select: { name: true } },
            },
          },
          student: { select: { id: true, name: true } },
        },
        orderBy: { enrolledAt: "desc" },
      });
    }),
});

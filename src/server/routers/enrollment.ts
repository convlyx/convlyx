import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, roleProtectedProcedure } from "../trpc";
import {
  enrollSchema,
  markAttendanceSchema,
  addNoteSchema,
  bulkSetAttendanceSchema,
  bulkMarkAttendanceSchema,
  listByStudentSchema,
} from "@/lib/validations/enrollment";
import { recordNotification, dispatchPush, formatClassTime, type PushJob } from "../lib/notifications";
import { hasStudentScheduleConflict } from "../lib/schedule-conflict";
import { getStudentClassAccess } from "../lib/student-access";
import { studentCheckInSchema } from "@/lib/validations/checkin";
import { verifyToken } from "../lib/checkin-token";

export const enrollmentRouter = router({
  /** Enroll a student in a class session */
  enroll: protectedProcedure
    .input(enrollSchema)
    .mutation(async ({ ctx, input }) => {
      // Students can only enroll themselves
      const studentId =
        ctx.membership.role === "STUDENT" ? ctx.user.id : (input.studentId ?? ctx.user.id);

      if (ctx.membership.role === "STUDENT" && input.studentId && input.studentId !== ctx.user.id) {
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
          endsAt: true,
          capacity: true,
          status: true,
          instructorId: true,
          schoolId: true,
          classType: true,
          category: true,
          school: { select: { practicalSelfEnrollEnabled: true, timeZone: true } },
          _count: {
            select: {
              enrollments: true,
            },
          },
        },
      });

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "classes.notFound" });
      }

      // Instructors can only enroll students into their own classes
      if (ctx.membership.role === "INSTRUCTOR" && session.instructorId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "auth.insufficientPermissions",
        });
      }

      // Verify student belongs to this tenant (when enrolling someone else)
      if (studentId !== ctx.user.id) {
        const student = await ctx.db.user.findFirst({
          where: { id: studentId, tenantId: ctx.tenantId, role: "STUDENT", status: "ACTIVE" },
          select: { id: true },
        });
        if (!student) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "users.notFound" });
        }
      }

      const isStaff = ["ADMIN", "SECRETARY", "INSTRUCTOR"].includes(ctx.membership.role);
      const allowedStatuses = isStaff
        ? ["SCHEDULED", "IN_PROGRESS", "COMPLETED"]
        : ["SCHEDULED"];

      if (!allowedStatuses.includes(session.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "enrollments.classNotAvailable",
        });
      }

      // Domain rules for student self-enrollment: class must match active
      // course's category (practical) or be theory (only if not yet passed).
      // Staff bypass these checks since they enrol students operationally.
      if (ctx.membership.role === "STUDENT" && studentId === ctx.user.id) {
        const { activeCategory, canSeeTheory } = await getStudentClassAccess(
          ctx.db,
          ctx.tenantId,
          ctx.user.id,
        );
        if (!activeCategory) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "enrollments.noActiveCourse",
          });
        }
        if (session.classType === "THEORY" && !canSeeTheory) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "enrollments.theoryAlreadyPassed",
          });
        }
        if (session.classType === "PRACTICAL") {
          if (!session.school.practicalSelfEnrollEnabled) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "enrollments.practicalSelfEnrollDisabled",
            });
          }
          if (session.category !== activeCategory) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "enrollments.categoryMismatch",
            });
          }
        }
      }

      if (session._count.enrollments >= session.capacity) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "enrollments.classFull",
        });
      }

      // Check student is not already enrolled. Uses findFirst (not
      // findUnique) so the tenant-scope extension can merge tenantId
      // into the where clause.
      const existing = await ctx.db.enrollment.findFirst({
        where: {
          sessionId: input.sessionId,
          studentId,
        },
        select: { id: true, status: true },
      });

      if (existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "enrollments.alreadyEnrolled",
        });
      }

      // A student can't be in two places at once: reject if they already have
      // a class or scheduled exam overlapping this session's window. (Skipped
      // for COMPLETED sessions, which are recorded retroactively, not booked.)
      if (session.status !== "COMPLETED") {
        const conflict = await hasStudentScheduleConflict({
          db: ctx.db,
          tenantId: ctx.tenantId,
          studentIds: [studentId],
          windows: [{ startsAt: session.startsAt, endsAt: session.endsAt }],
          excludeSessionId: session.id,
        });
        if (conflict) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "enrollments.studentScheduleConflict",
          });
        }
      }

      const enrollStatus = session.status === "COMPLETED" ? "ATTENDED" : "ENROLLED";

      // The enrollment insert + notification (when enrolled by someone else)
      // land in one transaction so a notification-write failure rolls back
      // the whole thing instead of leaving a silent enrollment.
      const jobs: (PushJob | null)[] = [];
      const result = await ctx.db.$transaction(async (tx) => {
        const created = await tx.enrollment.create({
          data: {
            tenantId: ctx.tenantId,
            schoolId: session.schoolId,
            sessionId: input.sessionId,
            studentId,
            status: enrollStatus,
          },
          select: { id: true, status: true },
        });

        // Notify student if enrolled by someone else
        if (studentId !== ctx.user.id) {
          jobs.push(
            await recordNotification(tx, {
              tenantId: ctx.tenantId,
              userId: studentId,
              type: "enrollment.created",
              titleKey: "notifications.enrollmentWasConfirmed",
              messageKey: "notifications.classAssigned",
              params: { title: session.title, time: formatClassTime(new Date(session.startsAt), session.school.timeZone) },
            }),
          );
        }

        return created;
      });
      dispatchPush(ctx.db, jobs);

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
          session: {
            select: {
              id: true,
              title: true,
              startsAt: true,
              instructorId: true,
              school: { select: { cancellationNoticeHours: true, timeZone: true } },
            },
          },
        },
      });

      if (!enrollment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "enrollments.notFound" });
      }

      // Instructors can only cancel enrollments in their own classes
      if (ctx.membership.role === "INSTRUCTOR" && enrollment.session.instructorId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "auth.insufficientPermissions",
        });
      }

      // Students can only cancel their own, only while ENROLLED, and only outside
      // the school's cancellation notice window (default 24h, configurable).
      if (ctx.membership.role === "STUDENT") {
        if (enrollment.studentId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "auth.insufficientPermissions",
          });
        }
        if (enrollment.status !== "ENROLLED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "enrollments.notActive",
          });
        }
        const noticeHours = enrollment.session.school.cancellationNoticeHours;
        if (noticeHours > 0) {
          const cutoff = new Date(enrollment.session.startsAt.getTime() - noticeHours * 3600_000);
          if (new Date() > cutoff) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "enrollments.cancellationTooLate",
            });
          }
        }
      }

      // The enrollment delete + notification (when cancelled by someone else)
      // land in one transaction so a notification-write failure rolls back
      // the whole thing instead of leaving a silent cancellation.
      const jobs: (PushJob | null)[] = [];
      await ctx.db.$transaction(async (tx) => {
        await tx.enrollment.delete({
          where: { id: input.enrollmentId },
        });

        // Notify student if removed by admin/secretary (not self-cancellation)
        if (enrollment.studentId !== ctx.user.id) {
          jobs.push(
            await recordNotification(tx, {
              tenantId: ctx.tenantId,
              userId: enrollment.studentId,
              type: "enrollment.cancelled",
              titleKey: "notifications.enrollmentWasCancelled",
              messageKey: "notifications.enrollmentCancelled",
              params: { title: enrollment.session.title, time: formatClassTime(new Date(enrollment.session.startsAt), enrollment.session.school.timeZone) },
            }),
          );
        }
      });
      dispatchPush(ctx.db, jobs);

      return { success: true };
    }),

  /** Mark attendance (instructor, secretary, admin) */
  markAttendance: roleProtectedProcedure(["ADMIN", "SECRETARY", "INSTRUCTOR"])
    .input(markAttendanceSchema)
    .mutation(async ({ ctx, input }) => {
      // Instructors can only mark attendance on classes they teach. Staff
      // can mark anything in the tenant.
      const enrollment = await ctx.db.enrollment.findFirst({
        where: {
          id: input.enrollmentId,
          tenantId: ctx.tenantId,
          status: { in: ["ENROLLED", "ATTENDED", "NO_SHOW"] },
          ...(ctx.membership.role === "INSTRUCTOR" && {
            session: { instructorId: ctx.user.id },
          }),
        },
        select: { id: true },
      });

      if (!enrollment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "enrollments.notFound" });
      }

      return ctx.db.enrollment.update({
        where: { id: input.enrollmentId },
        data: { status: input.status },
        select: { id: true, status: true },
      });
    }),

  /** Add or update instructor notes on an enrollment */
  addNote: roleProtectedProcedure(["INSTRUCTOR"])
    .input(addNoteSchema)
    .mutation(async ({ ctx, input }) => {
      // Instructors can only annotate enrollments in classes they teach.
      const enrollment = await ctx.db.enrollment.findFirst({
        where: {
          id: input.enrollmentId,
          tenantId: ctx.tenantId,
          session: { instructorId: ctx.user.id },
        },
        select: { id: true },
      });

      if (!enrollment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "enrollments.notFound" });
      }

      await ctx.db.enrollment.update({
        where: { id: input.enrollmentId },
        data: { notes: input.notes },
      });

      return { success: true };
    }),

  /**
   * Classes the current instructor taught in the last 14 days that still have
   * at least one enrollment in ENROLLED state (i.e. attendance never recorded).
   * Used by the post-class attendance nudge modal on the dashboard.
   */
  pendingAttendance: roleProtectedProcedure(["INSTRUCTOR"])
    .query(async ({ ctx }) => {
      const now = new Date();
      const lookbackStart = new Date(now.getTime() - 14 * 24 * 3600 * 1000);

      const sessions = await ctx.db.classSession.findMany({
        where: {
          tenantId: ctx.tenantId,
          instructorId: ctx.user.id,
          status: { not: "CANCELLED" },
          endsAt: { lt: now, gte: lookbackStart },
          enrollments: { some: { status: "ENROLLED" } },
        },
        select: {
          id: true,
          title: true,
          classType: true,
          category: true,
          startsAt: true,
          endsAt: true,
          enrollments: {
            where: { status: "ENROLLED" },
            select: {
              id: true,
              student: { select: { id: true, name: true } },
            },
            orderBy: { student: { name: "asc" } },
          },
        },
        orderBy: { endsAt: "desc" },
      });

      return sessions;
    }),

  /**
   * Save attendance for several enrollments at once. Used by the post-class
   * nudge modal so the whole card saves in a single round-trip. All entries
   * must belong to the same session, and that session must be in the caller's
   * tenant (plus belong to the caller if they are an INSTRUCTOR).
   */
  bulkSetAttendance: roleProtectedProcedure(["ADMIN", "SECRETARY", "INSTRUCTOR"])
    .input(bulkSetAttendanceSchema)
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.classSession.findFirst({
        where: {
          id: input.sessionId,
          tenantId: ctx.tenantId,
          ...(ctx.membership.role === "INSTRUCTOR" && { instructorId: ctx.user.id }),
        },
        select: { id: true },
      });
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "classes.notFound" });
      }

      const enrollmentIds = input.entries.map((e) => e.enrollmentId);
      const matchingCount = await ctx.db.enrollment.count({
        where: { id: { in: enrollmentIds }, sessionId: input.sessionId, tenantId: ctx.tenantId },
      });
      if (matchingCount !== enrollmentIds.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "enrollments.notFound" });
      }

      await ctx.db.$transaction(
        input.entries.map((entry) =>
          ctx.db.enrollment.update({
            where: { id: entry.enrollmentId },
            data: { status: entry.status },
          })
        )
      );

      return { count: input.entries.length };
    }),

  /** Bulk mark attendance for all enrolled students in a session */
  bulkMarkAttendance: roleProtectedProcedure(["ADMIN", "SECRETARY", "INSTRUCTOR"])
    .input(bulkMarkAttendanceSchema)
    .mutation(async ({ ctx, input }) => {
      // Instructors can only mark their own classes; staff can mark anything
      // in the tenant.
      const session = await ctx.db.classSession.findFirst({
        where: {
          id: input.sessionId,
          tenantId: ctx.tenantId,
          ...(ctx.membership.role === "INSTRUCTOR" && { instructorId: ctx.user.id }),
        },
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
    .input(listByStudentSchema)
    .query(async ({ ctx, input }) => {
      const studentId =
        ctx.membership.role === "STUDENT" ? ctx.user.id : input?.studentId;

      const now = new Date();
      const timeFilter =
        input?.time === "current"
          ? { status: "ENROLLED" as const, session: { startsAt: { gte: now } } }
          : input?.time === "past"
            ? {
                OR: [
                  { status: { not: "ENROLLED" as const } },
                  { session: { startsAt: { lt: now } } },
                ],
              }
            : {};

      const where = {
        tenantId: ctx.tenantId,
        ...(studentId && { studentId }),
        ...timeFilter,
      };

      const select = {
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
            school: { select: { cancellationNoticeHours: true } },
          },
        },
        student: { select: { id: true, name: true } },
      } as const;

      if (input?.page && input?.pageSize) {
        const [items, total] = await ctx.db.$transaction([
          ctx.db.enrollment.findMany({
            where,
            select,
            orderBy: { enrolledAt: "desc" },
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
          }),
          ctx.db.enrollment.count({ where }),
        ]);
        return { items, total };
      }

      const items = await ctx.db.enrollment.findMany({
        where,
        select,
        orderBy: { enrolledAt: "desc" },
      });
      return { items, total: items.length };
    }),

  /**
   * Lightweight counts for the student dashboard progress card — three COUNT
   * queries instead of loading every enrollment row, so the card loads
   * independently of (and faster than) the upcoming-enrollments list.
   */
  studentStats: protectedProcedure
    .input(listByStudentSchema)
    .query(async ({ ctx, input }) => {
      const studentId =
        ctx.membership.role === "STUDENT" ? ctx.user.id : input?.studentId;
      const base = { tenantId: ctx.tenantId, ...(studentId && { studentId }) };
      const [scheduled, attended, noShow] = await ctx.db.$transaction([
        ctx.db.enrollment.count({
          where: {
            ...base,
            status: "ENROLLED",
            session: { startsAt: { gte: new Date() }, status: "SCHEDULED" },
          },
        }),
        ctx.db.enrollment.count({ where: { ...base, status: "ATTENDED" } }),
        ctx.db.enrollment.count({ where: { ...base, status: "NO_SHOW" } }),
      ]);
      return { scheduled, attended, noShow };
    }),

  /**
   * Student self-check-in via the instructor's rotating QR. Validates the
   * token + same-school eligibility, marks ATTENDED (idempotent), and
   * auto-enrolls walk-ins when capacity allows. Theory classes only.
   */
  checkIn: roleProtectedProcedure(["STUDENT"])
    .input(studentCheckInSchema)
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.classSession.findFirst({
        where: { id: input.sessionId, tenantId: ctx.tenantId },
        select: {
          id: true,
          title: true,
          classType: true,
          schoolId: true,
          capacity: true,
          checkInOpenedAt: true,
          checkInSecret: true,
          _count: { select: { enrollments: true } },
        },
      });
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "classes.notFound" });
      }
      if (session.classType !== "THEORY") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "checkin.notTheory" });
      }
      if (session.schoolId !== ctx.membership.schoolId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "checkin.differentSchool" });
      }
      if (!session.checkInOpenedAt || !session.checkInSecret) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "checkin.windowClosed" });
      }
      if (!verifyToken(session.checkInSecret, session.id, input.token, Date.now())) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "checkin.tokenExpired" });
      }

      const existing = await ctx.db.enrollment.findFirst({
        where: { sessionId: session.id, studentId: ctx.user.id },
        select: { id: true, status: true },
      });

      if (existing) {
        if (existing.status === "ATTENDED") {
          return { success: true, title: session.title, alreadyMarked: true };
        }
        await ctx.db.enrollment.update({
          where: { id: existing.id },
          data: { status: "ATTENDED", checkedInAt: new Date() },
        });
        return { success: true, title: session.title, alreadyMarked: false };
      }

      // Walk-in: auto-enroll if there is room.
      if (session._count.enrollments >= session.capacity) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "enrollments.classFull" });
      }
      await ctx.db.enrollment.create({
        data: {
          tenantId: ctx.tenantId,
          schoolId: session.schoolId,
          sessionId: session.id,
          studentId: ctx.user.id,
          status: "ATTENDED",
          checkedInAt: new Date(),
        },
      });
      return { success: true, title: session.title, alreadyMarked: false };
    }),

  /**
   * The theory session the student can mark presence for *right now* — drives
   * whether the "Marcar presença" card shows. Returns the session when the
   * student is enrolled-but-not-yet-ATTENDED, or could walk in (capacity left);
   * null once they're marked or no theory class is in its window.
   */
  markableSession: roleProtectedProcedure(["STUDENT"])
    .query(async ({ ctx }) => {
      const now = new Date();
      const session = await ctx.db.classSession.findFirst({
        where: {
          tenantId: ctx.tenantId,
          schoolId: ctx.membership.schoolId,
          classType: "THEORY",
          status: { not: "CANCELLED" },
          startsAt: { lte: now },
          endsAt: { gte: now },
        },
        select: {
          id: true,
          title: true,
          capacity: true,
          enrollments: {
            where: { studentId: ctx.user.id },
            select: { status: true },
          },
          _count: { select: { enrollments: true } },
        },
        orderBy: { startsAt: "asc" },
      });
      if (!session) return null;

      const mine = session.enrollments[0];
      if (mine) {
        return mine.status === "ATTENDED" ? null : { id: session.id, title: session.title };
      }
      // Walk-in: only offer it if there's still capacity.
      return session._count.enrollments >= session.capacity
        ? null
        : { id: session.id, title: session.title };
    }),
});

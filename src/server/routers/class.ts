import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, roleProtectedProcedure } from "../trpc";
import {
  createClassSchema,
  updateClassSchema,
  cancelClassSchema,
  listClassesSchema,
} from "@/lib/validations/class";
import { createNotification, createNotifications, formatClassTime } from "../lib/notifications";
import { getStudentClassAccess } from "../lib/student-access";
import { hasInstructorScheduleConflict, hasStudentScheduleConflict } from "../lib/schedule-conflict";
import { wallClockToUTC } from "@/lib/dates";
import { logger } from "@/lib/logger";
import { checkInSessionSchema } from "@/lib/validations/checkin";
import { generateSecret, currentToken, CHECKIN_WINDOW_MS } from "../lib/checkin-token";

export const classRouter = router({
  list: protectedProcedure
    .input(listClassesSchema)
    .query(async ({ ctx, input }) => {
      // Status accuracy is maintained by the `sync-class-statuses` cron
      // (every minute) — this read path stays a pure SELECT.

      // Instructors see only their classes, students see available + enrolled.
      // The role-level instructor pin always wins over an explicit input filter.
      const instructorFilter =
        ctx.user.role === "INSTRUCTOR"
          ? { instructorId: ctx.user.id }
          : input?.instructorId
            ? { instructorId: input.instructorId }
            : {};

      // Students only see classes relevant to their active carta de condução:
      // practical classes match their active category; theory classes are
      // hidden once they've passed the theory exam for that category. Without
      // an active course, no classes are visible.
      let studentFilter: object = {};
      if (ctx.user.role === "STUDENT") {
        const { activeCategory, canSeeTheory } = await getStudentClassAccess(
          ctx.db,
          ctx.tenantId,
          ctx.user.id,
        );
        if (!activeCategory) {
          return { items: [], total: 0 };
        }
        studentFilter = {
          OR: [
            ...(canSeeTheory ? [{ classType: "THEORY" as const }] : []),
            { classType: "PRACTICAL" as const, category: activeCategory },
          ],
        };
      }

      // Explicit from/to (calendar/dashboard date windows) filter on startsAt.
      const startsAtFilter: { gte?: Date; lte?: Date } = {};
      if (input?.from) startsAtFilter.gte = new Date(input.from);
      if (input?.to) startsAtFilter.lte = new Date(input.to);

      // The upcoming/past tabs split on whether the class has ENDED, not on
      // when it starts — so a class happening right now counts as
      // "upcoming/current" instead of falling between the two tabs.
      const endsAtFilter: { gte?: Date; lt?: Date } = {};
      if (!input?.from && !input?.to && input?.time) {
        const now = new Date();
        if (input.time === "upcoming") endsAtFilter.gte = now;
        else endsAtFilter.lt = now;
      }

      const where = {
        tenantId: ctx.tenantId,
        ...instructorFilter,
        ...studentFilter,
        ...(input?.schoolId && { schoolId: input.schoolId }),
        ...(input?.classType && { classType: input.classType }),
        ...(input?.category && { category: input.category }),
        ...(Object.keys(startsAtFilter).length > 0 && { startsAt: startsAtFilter }),
        ...(Object.keys(endsAtFilter).length > 0 && { endsAt: endsAtFilter }),
        ...(input?.search && {
          title: { contains: input.search, mode: "insensitive" as const },
        }),
        ...(input?.status && input.status !== "ALL"
          ? { status: input.status }
          : !input?.status
            ? { status: { not: "CANCELLED" as const } }
            : {}),
      };

      const select = {
        id: true,
        classType: true,
        category: true,
        title: true,
        startsAt: true,
        endsAt: true,
        capacity: true,
        status: true,
        instructor: { select: { id: true, name: true } },
        school: { select: { id: true, name: true, timeZone: true } },
        _count: { select: { enrollments: true } },
      } as const;

      // When paginating, use a transaction to fetch the page + total in a
      // single round-trip. Otherwise return the full set (calendar/dashboards
      // need every row in their date window).
      if (input?.page && input?.pageSize) {
        const [items, total] = await ctx.db.$transaction([
          ctx.db.classSession.findMany({
            where,
            select,
            orderBy: { startsAt: "asc" },
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
          }),
          ctx.db.classSession.count({ where }),
        ]);
        return { items, total };
      }

      const items = await ctx.db.classSession.findMany({
        where,
        select,
        orderBy: { startsAt: "asc" },
      });
      return { items, total: items.length };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.classSession.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: {
          id: true,
          classType: true,
          category: true,
          title: true,
          startsAt: true,
          endsAt: true,
          capacity: true,
          status: true,
          createdAt: true,
          instructor: { select: { id: true, name: true } },
          school: { select: { id: true, name: true, cancellationNoticeHours: true, timeZone: true } },
          createdBy: { select: { id: true, name: true } },
          enrollments: {
            select: {
              id: true,
              status: true,
              notes: true,
              enrolledAt: true,
              student: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      // Students only see their own enrollment, with notes stripped
      if (result && ctx.user.role === "STUDENT") {
        return {
          ...result,
          enrollments: result.enrollments
            .filter((e) => e.student.id === ctx.user.id)
            .map((e) => ({ ...e, notes: null })),
        };
      }

      return result;
    }),

  /** Open the QR self-check-in window for a theory class (instructor/staff). */
  openCheckIn: roleProtectedProcedure(["ADMIN", "SECRETARY", "INSTRUCTOR"])
    .input(checkInSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.classSession.findFirst({
        where: {
          id: input.sessionId,
          tenantId: ctx.tenantId,
          ...(ctx.user.role === "INSTRUCTOR" && { instructorId: ctx.user.id }),
        },
        select: { id: true, classType: true, status: true },
      });
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "classes.notFound" });
      }
      if (session.classType !== "THEORY") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "checkin.notTheory" });
      }
      if (session.status === "CANCELLED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "checkin.classCancelled" });
      }
      await ctx.db.classSession.update({
        where: { id: session.id },
        data: {
          checkInOpenedAt: new Date(),
          checkInSecret: generateSecret(),
          status: "IN_PROGRESS",
          updatedById: ctx.user.id,
        },
      });
      return { success: true };
    }),

  /** Close the check-in window — clears the secret so all live QRs die. */
  closeCheckIn: roleProtectedProcedure(["ADMIN", "SECRETARY", "INSTRUCTOR"])
    .input(checkInSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.classSession.findFirst({
        where: {
          id: input.sessionId,
          tenantId: ctx.tenantId,
          ...(ctx.user.role === "INSTRUCTOR" && { instructorId: ctx.user.id }),
        },
        select: { id: true },
      });
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "classes.notFound" });
      }
      await ctx.db.classSession.update({
        where: { id: session.id },
        data: { checkInOpenedAt: null, checkInSecret: null, updatedById: ctx.user.id },
      });
      return { success: true };
    }),

  /**
   * Current QR token + live check-in state for the display screen. Polled
   * client-side every ~windowMs. The secret never leaves the server — only the
   * derived, short-lived token does.
   */
  getCheckInToken: roleProtectedProcedure(["ADMIN", "SECRETARY", "INSTRUCTOR"])
    .input(checkInSessionSchema)
    .query(async ({ ctx, input }) => {
      const session = await ctx.db.classSession.findFirst({
        where: {
          id: input.sessionId,
          tenantId: ctx.tenantId,
          ...(ctx.user.role === "INSTRUCTOR" && { instructorId: ctx.user.id }),
        },
        select: {
          id: true,
          title: true,
          capacity: true,
          checkInOpenedAt: true,
          checkInSecret: true,
          enrollments: {
            where: { checkedInAt: { not: null } },
            select: { id: true, checkedInAt: true, student: { select: { name: true } } },
            orderBy: { checkedInAt: "desc" },
          },
        },
      });
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "classes.notFound" });
      }
      const checkInOpen = Boolean(session.checkInOpenedAt && session.checkInSecret);
      const token =
        checkInOpen && session.checkInSecret
          ? currentToken(session.checkInSecret, session.id, Date.now())
          : null;
      return {
        title: session.title,
        capacity: session.capacity,
        checkInOpen,
        token,
        windowMs: CHECKIN_WINDOW_MS,
        attendedCount: session.enrollments.length,
        recentCheckIns: session.enrollments
          .slice(0, 8)
          .map((e) => ({ id: e.id, name: e.student.name, checkedInAt: e.checkedInAt })),
      };
    }),

  create: roleProtectedProcedure(["ADMIN", "SECRETARY", "INSTRUCTOR"])
    .input(createClassSchema)
    .mutation(async ({ ctx, input }) => {
      // Instructors can only schedule classes for themselves
      if (ctx.user.role === "INSTRUCTOR" && input.instructorId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "auth.insufficientPermissions",
        });
      }

      // Verify school and instructor belong to this tenant
      const [school, instructor] = await Promise.all([
        ctx.db.school.findFirst({
          where: { id: input.schoolId, tenantId: ctx.tenantId },
          select: { id: true, timeZone: true },
        }),
        ctx.db.user.findFirst({
          where: {
            id: input.instructorId,
            tenantId: ctx.tenantId,
            role: "INSTRUCTOR",
            status: "ACTIVE",
          },
          select: { id: true },
        }),
      ]);

      if (!school) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "classes.schoolNotFound",
        });
      }

      if (!instructor) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "classes.instructorNotFound",
        });
      }

      // Recurring creation: generate sessions then check conflicts per occurrence
      if (input.recurrence) {
        const recurrenceInput = { ...input, recurrence: input.recurrence };
        const sessions = generateRecurringSessions(
          recurrenceInput,
          ctx.tenantId,
          ctx.user.id,
          school.timeZone,
        );

        if (sessions.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "classes.noSessionsGenerated",
          });
        }

        // Check the instructor isn't already booked (class OR exam) for any
        // of these generated occurrences.
        const conflictAny = await hasInstructorScheduleConflict({
          db: ctx.db,
          tenantId: ctx.tenantId,
          instructorId: input.instructorId,
          windows: sessions.map((s) => ({ startsAt: s.startsAt, endsAt: s.endsAt })),
        });

        if (conflictAny) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "classes.scheduleConflict",
          });
        }

        const created = await ctx.db.classSession.createMany({
          data: sessions,
        });

        return { count: created.count };
      }

      // One-off: check the instructor isn't booked (class OR exam) for this window.
      const conflict = await hasInstructorScheduleConflict({
        db: ctx.db,
        tenantId: ctx.tenantId,
        instructorId: input.instructorId,
        windows: [{ startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt) }],
      });

      if (conflict) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "classes.scheduleConflict",
        });
      }

      // None of the students being assigned may already have a class or
      // scheduled exam overlapping this window.
      if (input.studentIds && input.studentIds.length > 0) {
        const studentConflict = await hasStudentScheduleConflict({
          db: ctx.db,
          tenantId: ctx.tenantId,
          studentIds: input.studentIds,
          windows: [{ startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt) }],
        });
        if (studentConflict) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "classes.studentScheduleConflict",
          });
        }
      }

      // One-off creation
      const session = await ctx.db.classSession.create({
        data: {
          tenantId: ctx.tenantId,
          schoolId: input.schoolId,
          classType: input.classType,
          category: input.classType === "THEORY" ? null : input.category,
          instructorId: input.instructorId,
          title: input.title,
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          capacity: input.capacity,
          createdById: ctx.user.id,
          updatedById: ctx.user.id,
        },
        select: { id: true, title: true, startsAt: true },
      });

      const timeStr = formatClassTime(new Date(input.startsAt), school.timeZone);

      // Notify instructor about new class
      createNotification({
        db: ctx.db,
        tenantId: ctx.tenantId,
        userId: input.instructorId,
        type: "class.created",
        titleKey: "notifications.newClassAssigned",
        messageKey: "notifications.classCreatedInstructor",
        params: { title: session.title, time: timeStr },
      }).catch((e) => logger.warn("notification dispatch failed", { error: e }));

      // Auto-enroll assigned students (practical classes)
      if (input.studentIds && input.studentIds.length > 0) {
        await ctx.db.enrollment.createMany({
          data: input.studentIds.map((studentId) => ({
            tenantId: ctx.tenantId,
            schoolId: input.schoolId,
            sessionId: session.id,
            studentId,
          })),
        });

        createNotifications({
          db: ctx.db,
          tenantId: ctx.tenantId,
          userIds: input.studentIds,
          type: "class.assigned",
          titleKey: "notifications.newClass",
          messageKey: "notifications.classAssigned",
          params: { title: session.title, time: timeStr },
        }).catch((e) => logger.warn("notification dispatch failed", { error: e }));
      }

      return session;
    }),

  update: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(updateClassSchema)
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.classSession.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: {
          status: true,
          title: true,
          classType: true,
          startsAt: true,
          endsAt: true,
          instructorId: true,
          school: { select: { timeZone: true } },
          enrollments: { select: { studentId: true } },
        },
      });

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "classes.notFound" });
      }

      if (session.status === "CANCELLED" || session.status === "COMPLETED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "classes.cannotEditFinished",
        });
      }

      // Practical classes must always have a category; theory classes are
      // category-agnostic and may pass undefined to clear/leave it null.
      if (session.classType === "PRACTICAL" && !input.category) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "classes.categoryRequired",
        });
      }

      // Check for schedule conflicts (class OR exam, excluding this class).
      const conflict = await hasInstructorScheduleConflict({
        db: ctx.db,
        tenantId: ctx.tenantId,
        instructorId: input.instructorId,
        windows: [{ startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt) }],
        excludeClassId: input.id,
      });

      if (conflict) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "classes.scheduleConflict",
        });
      }

      // If the class moved, make sure none of the already-enrolled students
      // end up double-booked at the new time. Exclude this class so its own
      // enrollments don't count as a conflict against itself.
      const enrolledStudentIds = session.enrollments.map((e) => e.studentId);
      if (enrolledStudentIds.length > 0) {
        const studentConflict = await hasStudentScheduleConflict({
          db: ctx.db,
          tenantId: ctx.tenantId,
          studentIds: enrolledStudentIds,
          windows: [{ startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt) }],
          excludeSessionId: input.id,
        });
        if (studentConflict) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "classes.studentScheduleConflict",
          });
        }
      }

      const instructorChanged = session.instructorId !== input.instructorId;
      const toMinutes = (d: string | Date) => new Date(d).toISOString().slice(0, 16);
      const scheduleChanged =
        toMinutes(input.startsAt) !== toMinutes(session.startsAt) ||
        toMinutes(input.endsAt) !== toMinutes(session.endsAt);

      await ctx.db.classSession.updateMany({
        where: { id: input.id, tenantId: ctx.tenantId },
        data: {
          instructorId: input.instructorId,
          category: session.classType === "THEORY" ? null : input.category,
          title: input.title,
          capacity: input.capacity,
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          updatedById: ctx.user.id,
        },
      });

      // Notify on instructor change
      if (instructorChanged) {
        const timeStr = formatClassTime(new Date(input.startsAt), session.school.timeZone);
        const newInstructor = await ctx.db.user.findFirst({
          where: { id: input.instructorId },
          select: { name: true },
        });
        const newInstructorName = newInstructor?.name ?? "";

        // Notify old instructor (removed)
        createNotification({
          db: ctx.db,
          tenantId: ctx.tenantId,
          userId: session.instructorId,
          type: "class.instructorChanged",
          titleKey: "notifications.removedFromClass",
          messageKey: "notifications.removedFromClassMessage",
          params: { title: input.title, time: timeStr },
        }).catch((e) => logger.warn("notification dispatch failed", { error: e }));

        // Notify new instructor (assigned)
        createNotification({
          db: ctx.db,
          tenantId: ctx.tenantId,
          userId: input.instructorId,
          type: "class.instructorChanged",
          titleKey: "notifications.assignedToClass",
          messageKey: "notifications.assignedToClassMessage",
          params: { title: input.title, time: timeStr },
        }).catch((e) => logger.warn("notification dispatch failed", { error: e }));

        // Notify enrolled students
        const studentIds = session.enrollments.map((e) => e.studentId);
        if (studentIds.length > 0) {
          createNotifications({
            db: ctx.db,
            tenantId: ctx.tenantId,
            userIds: studentIds,
            type: "class.instructorChanged",
            titleKey: "notifications.instructorChanged",
            messageKey: "notifications.instructorChangedMessage",
            params: { title: input.title, time: timeStr, instructor: newInstructorName },
          }).catch((e) => logger.warn("notification dispatch failed", { error: e }));
        }
      }

      // Notify on schedule change (only students not already notified about instructor change)
      if (scheduleChanged && !instructorChanged) {
        const studentIds = session.enrollments.map((e) => e.studentId);
        const newTimeStr = formatClassTime(new Date(input.startsAt), session.school.timeZone);
        if (studentIds.length > 0) {
          createNotifications({
            db: ctx.db,
            tenantId: ctx.tenantId,
            userIds: studentIds,
            type: "class.scheduleChanged",
            titleKey: "notifications.scheduleChanged",
            messageKey: "notifications.scheduleChangedMessage",
            params: { title: input.title, time: newTimeStr },
          }).catch((e) => logger.warn("notification dispatch failed", { error: e }));
        }
        // Notify instructor about schedule change
        createNotification({
          db: ctx.db,
          tenantId: ctx.tenantId,
          userId: input.instructorId,
          type: "class.scheduleChanged",
          titleKey: "notifications.scheduleChanged",
          messageKey: "notifications.scheduleChangedMessage",
          params: { title: input.title, time: newTimeStr },
        }).catch((e) => logger.warn("notification dispatch failed", { error: e }));
      }

      return { id: input.id, title: input.title };
    }),

  cancel: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(cancelClassSchema)
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.classSession.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: {
          title: true,
          startsAt: true,
          status: true,
          instructorId: true,
          school: { select: { timeZone: true } },
          enrollments: {
            where: { status: "ENROLLED" },
            select: { studentId: true },
          },
        },
      });

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "classes.notFound" });
      }

      if (session.status === "COMPLETED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "classes.cannotCancelCompleted",
        });
      }

      const enrolledStudentIds = session.enrollments.map((e) => e.studentId);
      const timeStr = formatClassTime(new Date(session.startsAt), session.school.timeZone);

      await ctx.db.$transaction([
        ctx.db.classSession.updateMany({
          where: { id: input.id, tenantId: ctx.tenantId },
          data: { status: "CANCELLED", updatedById: ctx.user.id },
        }),
        ctx.db.enrollment.deleteMany({
          where: { sessionId: input.id, tenantId: ctx.tenantId },
        }),
      ]);

      if (enrolledStudentIds.length > 0) {
        createNotifications({
          db: ctx.db,
          tenantId: ctx.tenantId,
          userIds: enrolledStudentIds,
          type: "class.cancelled",
          titleKey: "notifications.classWasCancelled",
          messageKey: "notifications.classCancelled",
          params: { title: session.title, time: timeStr },
        }).catch((e) => logger.warn("notification dispatch failed", { error: e }));
      }

      createNotification({
        db: ctx.db,
        tenantId: ctx.tenantId,
        userId: session.instructorId,
        type: "class.cancelled",
        titleKey: "notifications.classWasCancelled",
        messageKey: "notifications.classCancelledInstructor",
        params: { title: session.title, time: timeStr },
      }).catch((e) => logger.warn("notification dispatch failed", { error: e }));

      return { success: true };
    }),

  /** Instructor marks themselves unavailable — cancels the class */
  instructorUnavailable: roleProtectedProcedure(["INSTRUCTOR"])
    .input(cancelClassSchema)
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.classSession.findFirst({
        where: {
          id: input.id,
          tenantId: ctx.tenantId,
          instructorId: ctx.user.id,
          status: "SCHEDULED",
        },
        select: {
          id: true,
          title: true,
          startsAt: true,
          school: { select: { timeZone: true } },
          enrollments: {
            where: { status: "ENROLLED" },
            select: { studentId: true },
          },
        },
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "classes.notFound",
        });
      }

      const enrolledStudentIds = session.enrollments.map((e) => e.studentId);
      const timeStr = formatClassTime(new Date(session.startsAt), session.school.timeZone);

      await ctx.db.$transaction([
        ctx.db.classSession.updateMany({
          where: { id: input.id, tenantId: ctx.tenantId },
          data: { status: "CANCELLED", updatedById: ctx.user.id },
        }),
        ctx.db.enrollment.deleteMany({
          where: { sessionId: input.id, tenantId: ctx.tenantId },
        }),
      ]);

      if (enrolledStudentIds.length > 0) {
        createNotifications({
          db: ctx.db,
          tenantId: ctx.tenantId,
          userIds: enrolledStudentIds,
          type: "class.cancelled",
          titleKey: "notifications.classWasCancelled",
          messageKey: "notifications.classCancelledByInstructor",
          params: { title: session.title, time: timeStr },
        }).catch((e) => logger.warn("notification dispatch failed", { error: e }));
      }

      // Notify admins/secretaries
      Promise.all([
        ctx.db.user.findFirst({
          where: { id: ctx.user.id },
          select: { name: true },
        }),
        ctx.db.user.findMany({
          where: {
            tenantId: ctx.tenantId,
            role: { in: ["ADMIN", "SECRETARY"] },
            status: "ACTIVE",
          },
          select: { id: true },
        }),
      ])
        .then(([instructor, admins]) => {
          const adminIds = admins.map((a) => a.id);
          if (adminIds.length > 0) {
            const instructorName = instructor?.name ?? "Instrutor";
            createNotifications({
              db: ctx.db,
              tenantId: ctx.tenantId,
              userIds: adminIds,
              type: "class.instructorUnavailable",
              titleKey: "notifications.instructorWasUnavailable",
              messageKey: "notifications.instructorUnavailable",
              params: { instructor: instructorName, title: session.title, time: timeStr },
            }).catch((e) => logger.warn("notification dispatch failed", { error: e }));
          }
        })
        .catch((e) => logger.warn("notification dispatch failed", { error: e, kind: "class.instructorUnavailable" }));

      return { success: true };
    }),
});

/**
 * Generates individual ClassSession rows from recurrence params.
 * Pure business logic — no DB tables for recurrence patterns.
 */
function generateRecurringSessions(
  input: {
    schoolId: string;
    classType: "THEORY" | "PRACTICAL";
    category?: import("@/lib/license-categories").LicenseCategory;
    instructorId: string;
    title: string;
    capacity: number;
    recurrence: {
      daysOfWeek: number[];
      startTime: string;
      endTime: string;
      validFrom: string;
      validUntil: string;
    };
  },
  tenantId: string,
  userId: string,
  timeZone: string,
) {
  const { recurrence } = input;
  const category = input.classType === "THEORY" ? null : (input.category ?? null);
  const sessions: Array<{
    tenantId: string;
    schoolId: string;
    classType: "THEORY" | "PRACTICAL";
    category: import("@/lib/license-categories").LicenseCategory | null;
    instructorId: string;
    title: string;
    capacity: number;
    startsAt: Date;
    endsAt: Date;
    createdById: string;
    updatedById: string;
  }> = [];

  const from = new Date(recurrence.validFrom);
  const until = new Date(recurrence.validUntil);
  const [startHour, startMin] = recurrence.startTime.split(":").map(Number);
  const [endHour, endMin] = recurrence.endTime.split(":").map(Number);

  // Map our ISO day (0=Monday) to JS day (0=Sunday)
  // Our 0=Mon,1=Tue,...,6=Sun → JS 1=Mon,2=Tue,...,0=Sun
  const jsDays = recurrence.daysOfWeek.map((d) => (d + 1) % 7);

  const current = new Date(from);
  while (current <= until) {
    // current.getDay() reads in server timezone; for UTC servers and dates parsed
    // from "YYYY-MM-DD" (which become UTC midnight), this is reliable.
    if (jsDays.includes(current.getUTCDay())) {
      const year = current.getUTCFullYear();
      const month = current.getUTCMonth();
      const day = current.getUTCDate();

      const startsAt = wallClockToUTC(year, month, day, startHour, startMin, timeZone);
      const endsAt = wallClockToUTC(year, month, day, endHour, endMin, timeZone);

      sessions.push({
        tenantId,
        schoolId: input.schoolId,
        classType: input.classType,
        category,
        instructorId: input.instructorId,
        title: input.title,
        capacity: input.capacity,
        startsAt,
        endsAt,
        createdById: userId,
        updatedById: userId,
      });
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return sessions;
}

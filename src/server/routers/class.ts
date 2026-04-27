import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, roleProtectedProcedure } from "../trpc";
import {
  createClassSchema,
  updateClassSchema,
  cancelClassSchema,
} from "@/lib/validations/class";
import { syncClassStatuses } from "../lib/class-status";
import { createNotification, createNotifications, formatClassTime } from "../lib/notifications";

export const classRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        schoolId: z.string().uuid().optional(),
        classType: z.enum(["THEORY", "PRACTICAL"]).optional(),
        status: z.enum(["ALL", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      // Auto-update class statuses based on current time
      await syncClassStatuses(ctx.db, ctx.tenantId);

      // Instructors see only their classes, students see available + enrolled
      const instructorFilter =
        ctx.user.role === "INSTRUCTOR"
          ? { instructorId: ctx.user.id }
          : {};

      return ctx.db.classSession.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...instructorFilter,
          ...(input?.schoolId && { schoolId: input.schoolId }),
          ...(input?.classType && { classType: input.classType }),
          ...(input?.from || input?.to
            ? {
                startsAt: {
                  ...(input?.from && { gte: new Date(input.from) }),
                  ...(input?.to && { lte: new Date(input.to) }),
                },
              }
            : {}),
          ...(input?.status && input.status !== "ALL" ? { status: input.status } : !input?.status ? { status: { not: "CANCELLED" as const } } : {}),
        },
        select: {
          id: true,
          classType: true,
          title: true,
          startsAt: true,
          endsAt: true,
          capacity: true,
          status: true,
          instructor: { select: { id: true, name: true } },
          school: { select: { id: true, name: true } },
          _count: { select: { enrollments: true } },
        },
        orderBy: { startsAt: "asc" },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.classSession.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: {
          id: true,
          classType: true,
          title: true,
          startsAt: true,
          endsAt: true,
          capacity: true,
          status: true,
          createdAt: true,
          instructor: { select: { id: true, name: true } },
          school: { select: { id: true, name: true } },
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

      // Strip internal notes from student view
      if (result && ctx.user.role === "STUDENT") {
        return {
          ...result,
          enrollments: result.enrollments.map((e) => ({ ...e, notes: null })),
        };
      }

      return result;
    }),

  create: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(createClassSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify school and instructor belong to this tenant
      const [school, instructor] = await Promise.all([
        ctx.db.school.findFirst({
          where: { id: input.schoolId, tenantId: ctx.tenantId },
          select: { id: true },
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

      // Check for schedule conflicts
      const conflict = await ctx.db.classSession.findFirst({
        where: {
          tenantId: ctx.tenantId,
          instructorId: input.instructorId,
          status: { not: "CANCELLED" },
          OR: [
            {
              startsAt: { lt: new Date(input.endsAt) },
              endsAt: { gt: new Date(input.startsAt) },
            },
          ],
        },
        select: { id: true, title: true, startsAt: true },
      });

      if (conflict) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "classes.scheduleConflict",
        });
      }

      // Recurring creation: generate multiple sessions
      if (input.recurrence) {
        const recurrenceInput = { ...input, recurrence: input.recurrence };
        const sessions = generateRecurringSessions(recurrenceInput, ctx.tenantId, ctx.user.id);

        if (sessions.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "classes.noSessionsGenerated",
          });
        }

        const created = await ctx.db.classSession.createMany({
          data: sessions,
        });

        return { count: created.count };
      }

      // One-off creation
      const session = await ctx.db.classSession.create({
        data: {
          tenantId: ctx.tenantId,
          schoolId: input.schoolId,
          classType: input.classType,
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

      const timeStr = formatClassTime(new Date(input.startsAt));

      // Notify instructor about new class
      createNotification({
        db: ctx.db,
        tenantId: ctx.tenantId,
        userId: input.instructorId,
        type: "class.created",
        titleKey: "notifications.newClassAssigned",
        messageKey: "notifications.classCreatedInstructor",
        params: { title: session.title, time: timeStr },
      }).catch(() => {});

      // Auto-enroll assigned students (practical classes)
      if (input.studentIds && input.studentIds.length > 0) {
        await ctx.db.enrollment.createMany({
          data: input.studentIds.map((studentId) => ({
            tenantId: ctx.tenantId,
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
        }).catch(() => {});
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
          startsAt: true,
          endsAt: true,
          instructorId: true,
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

      // Check for schedule conflicts (excluding the class being updated)
      const conflict = await ctx.db.classSession.findFirst({
        where: {
          tenantId: ctx.tenantId,
          instructorId: input.instructorId,
          id: { not: input.id },
          status: { not: "CANCELLED" },
          OR: [
            {
              startsAt: { lt: new Date(input.endsAt) },
              endsAt: { gt: new Date(input.startsAt) },
            },
          ],
        },
        select: { id: true },
      });

      if (conflict) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "classes.scheduleConflict",
        });
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
          title: input.title,
          capacity: input.capacity,
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          updatedById: ctx.user.id,
        },
      });

      // Notify on instructor change
      if (instructorChanged) {
        const timeStr = formatClassTime(new Date(input.startsAt));
        const newInstructor = await ctx.db.user.findUnique({
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
        }).catch(() => {});

        // Notify new instructor (assigned)
        createNotification({
          db: ctx.db,
          tenantId: ctx.tenantId,
          userId: input.instructorId,
          type: "class.instructorChanged",
          titleKey: "notifications.assignedToClass",
          messageKey: "notifications.assignedToClassMessage",
          params: { title: input.title, time: timeStr },
        }).catch(() => {});

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
          }).catch(() => {});
        }
      }

      // Notify on schedule change (only students not already notified about instructor change)
      if (scheduleChanged && !instructorChanged) {
        const studentIds = session.enrollments.map((e) => e.studentId);
        const newTimeStr = formatClassTime(new Date(input.startsAt));
        if (studentIds.length > 0) {
          createNotifications({
            db: ctx.db,
            tenantId: ctx.tenantId,
            userIds: studentIds,
            type: "class.scheduleChanged",
            titleKey: "notifications.scheduleChanged",
            messageKey: "notifications.scheduleChangedMessage",
            params: { title: input.title, time: newTimeStr },
          }).catch(() => {});
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
        }).catch(() => {});
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
      const timeStr = formatClassTime(new Date(session.startsAt));

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
        }).catch(() => {});
      }

      createNotification({
        db: ctx.db,
        tenantId: ctx.tenantId,
        userId: session.instructorId,
        type: "class.cancelled",
        titleKey: "notifications.classWasCancelled",
        messageKey: "notifications.classCancelledInstructor",
        params: { title: session.title, time: timeStr },
      }).catch(() => {});

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
      const timeStr = formatClassTime(new Date(session.startsAt));

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
        }).catch(() => {});
      }

      // Notify admins/secretaries
      Promise.all([
        ctx.db.user.findUnique({
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
            }).catch(() => {});
          }
        })
        .catch(() => {});

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
  userId: string
) {
  const { recurrence } = input;
  const sessions: Array<{
    tenantId: string;
    schoolId: string;
    classType: "THEORY" | "PRACTICAL";
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
    if (jsDays.includes(current.getDay())) {
      const startsAt = new Date(current);
      startsAt.setHours(startHour, startMin, 0, 0);

      const endsAt = new Date(current);
      endsAt.setHours(endHour, endMin, 0, 0);

      sessions.push({
        tenantId,
        schoolId: input.schoolId,
        classType: input.classType,
        instructorId: input.instructorId,
        title: input.title,
        capacity: input.capacity,
        startsAt,
        endsAt,
        createdById: userId,
        updatedById: userId,
      });
    }

    current.setDate(current.getDate() + 1);
  }

  return sessions;
}

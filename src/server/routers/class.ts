import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, roleProtectedProcedure } from "../trpc";
import {
  createClassSchema,
  updateClassSchema,
  cancelClassSchema,
} from "@/lib/validations/class";

export const classRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        schoolId: z.string().uuid().optional(),
        classType: z.enum(["THEORY", "PRACTICAL"]).optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
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
          ...(input?.from && {
            startsAt: { gte: new Date(input.from) },
          }),
          ...(input?.to && {
            endsAt: { lte: new Date(input.to) },
          }),
          status: { not: "CANCELLED" },
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
      return ctx.db.classSession.findFirst({
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
              enrolledAt: true,
              student: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });
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
      return ctx.db.classSession.create({
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
    }),

  update: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(updateClassSchema)
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.classSession.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: { status: true },
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

      return ctx.db.classSession.update({
        where: { id: input.id },
        data: {
          instructorId: input.instructorId,
          title: input.title,
          capacity: input.capacity,
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          updatedById: ctx.user.id,
        },
        select: { id: true, title: true },
      });
    }),

  cancel: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(cancelClassSchema)
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.classSession.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: { status: true },
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

      // Cancel the session and all active enrollments
      await ctx.db.$transaction([
        ctx.db.classSession.update({
          where: { id: input.id },
          data: { status: "CANCELLED", updatedById: ctx.user.id },
        }),
        ctx.db.enrollment.updateMany({
          where: { sessionId: input.id, status: "ENROLLED" },
          data: { status: "CANCELLED" },
        }),
      ]);

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

import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createClient } from "@supabase/supabase-js";
import { router, protectedProcedure, roleProtectedProcedure } from "../trpc";
import { createUserSchema, updateUserSchema } from "@/lib/validations/user";
import { createNotification } from "../lib/notifications";

// Admin client for creating auth users
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export const userRouter = router({
  list: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(
      z.object({
        schoolId: z.string().uuid().optional(),
        role: z.enum(["ADMIN", "SECRETARY", "INSTRUCTOR", "STUDENT"]).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.user.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(input?.schoolId && { schoolId: input.schoolId }),
          ...(input?.role && { role: input.role }),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
          school: { select: { id: true, name: true } },
        },
        orderBy: { name: "asc" },
      });
    }),

  getById: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.user.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          schoolId: true,
          school: { select: { id: true, name: true } },
          createdAt: true,
        },
      });
    }),

  create: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(createUserSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify the school belongs to this tenant
      const school = await ctx.db.school.findFirst({
        where: { id: input.schoolId, tenantId: ctx.tenantId },
        select: { id: true },
      });

      if (!school) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "classes.schoolNotFound",
        });
      }

      // Invite user via email — they'll set their own password
      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.inviteUserByEmail(input.email, {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/update-password`,
        });

      if (authError) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: authError.message,
        });
      }

      // Create Prisma user profile
      const user = await ctx.db.user.create({
        data: {
          id: authData.user.id,
          tenantId: ctx.tenantId,
          schoolId: input.schoolId,
          email: input.email,
          name: input.name,
          phone: input.phone,
          role: input.role,
        },
        select: { id: true, name: true, email: true, role: true },
      });

      return user;
    }),

  update: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(updateUserSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify the school belongs to this tenant
      const school = await ctx.db.school.findFirst({
        where: { id: input.schoolId, tenantId: ctx.tenantId },
        select: { id: true },
      });

      if (!school) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "classes.schoolNotFound",
        });
      }

      return ctx.db.user.updateMany({
        where: { id: input.id, tenantId: ctx.tenantId },
        data: {
          name: input.name,
          phone: input.phone,
          role: input.role,
          schoolId: input.schoolId,
        },
      });
    }),

  deactivate: roleProtectedProcedure(["ADMIN"])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "users.cannotDeactivateSelf",
        });
      }

      const result = await ctx.db.user.updateMany({
        where: { id: input.id, tenantId: ctx.tenantId },
        data: { status: "INACTIVE" },
      });

      // Notify the deactivated user
      createNotification({
        db: ctx.db,
        tenantId: ctx.tenantId,
        userId: input.id,
        type: "user.deactivated",
        titleKey: "notifications.accountWasDeactivated",
        messageKey: "notifications.accountDeactivated",
      }).catch(() => {});

      return result;
    }),

  activate: roleProtectedProcedure(["ADMIN"])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.updateMany({
        where: { id: input.id, tenantId: ctx.tenantId },
        data: { status: "ACTIVE" },
      });
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.user.id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          school: { select: { id: true, name: true, address: true, phone: true } },
          tenant: { select: { id: true, name: true } },
        },
      });
      return user;
    }),

  updateProfile: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.user.update({
        where: { id: ctx.user.id },
        data: { name: input.name },
      });
      return { success: true };
    }),

  /** Student profile with enrollment stats and history */
  studentProfile: roleProtectedProcedure(["ADMIN", "SECRETARY", "INSTRUCTOR"])
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const student = await ctx.db.user.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId, role: "STUDENT" },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,
          school: { select: { id: true, name: true } },
          enrollments: {
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
            },
            orderBy: { enrolledAt: "desc" },
          },
        },
      });

      if (!student) {
        throw new TRPCError({ code: "NOT_FOUND", message: "users.notFound" });
      }

      const enrollments = student.enrollments;
      const stats = {
        totalEnrolled: enrollments.filter((e) => e.status === "ENROLLED").length,
        totalAttended: enrollments.filter((e) => e.status === "ATTENDED").length,
        totalNoShow: enrollments.filter((e) => e.status === "NO_SHOW").length,
        totalCancelled: enrollments.filter((e) => e.status === "CANCELLED").length,
        theoryAttended: enrollments.filter((e) => e.status === "ATTENDED" && e.session.classType === "THEORY").length,
        practicalAttended: enrollments.filter((e) => e.status === "ATTENDED" && e.session.classType === "PRACTICAL").length,
        upcoming: enrollments.filter((e) => e.status === "ENROLLED" && new Date(e.session.startsAt) > new Date()).length,
      };

      return { ...student, stats };
    }),

  /** Instructor profile with class stats and schedule */
  instructorProfile: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const instructor = await ctx.db.user.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId, role: "INSTRUCTOR" },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,
          school: { select: { id: true, name: true } },
          instructedSessions: {
            select: {
              id: true,
              title: true,
              classType: true,
              startsAt: true,
              endsAt: true,
              status: true,
              capacity: true,
              _count: { select: { enrollments: true } },
            },
            orderBy: { startsAt: "desc" },
          },
        },
      });

      if (!instructor) {
        throw new TRPCError({ code: "NOT_FOUND", message: "users.notFound" });
      }

      const sessions = instructor.instructedSessions;
      const now = new Date();
      const stats = {
        totalClasses: sessions.length,
        completedClasses: sessions.filter((s) => s.status === "COMPLETED").length,
        upcomingClasses: sessions.filter((s) => s.status === "SCHEDULED" && new Date(s.startsAt) > now).length,
        cancelledClasses: sessions.filter((s) => s.status === "CANCELLED").length,
        theoryClasses: sessions.filter((s) => s.classType === "THEORY").length,
        practicalClasses: sessions.filter((s) => s.classType === "PRACTICAL").length,
        totalStudentsTaught: sessions.reduce((acc, s) => acc + s._count.enrollments, 0),
      };

      return { ...instructor, stats };
    }),
});

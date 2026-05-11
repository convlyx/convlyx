import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createClient } from "@supabase/supabase-js";
import { router, protectedProcedure, roleProtectedProcedure } from "../trpc";
import { createUserSchema, updateUserSchema } from "@/lib/validations/user";
import { createNotification } from "../lib/notifications";
import { syncClassStatuses } from "../lib/class-status";

// Admin client for creating auth users
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Anon client used to trigger email-sending flows (e.g. password reset)
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * A STUDENT is deletable if they have no Enrollment and no Exam (via any of
 * their StudentCourses). An INSTRUCTOR is deletable if no ClassSession or
 * Exam references them — including audit FKs (createdBy/updatedBy).
 *
 * Cascade-only references (Notification, PushSubscription, StudentCourse for
 * students with no exams) do not block.
 */
async function computeDeletability(
  db: typeof import("../db").db,
  tenantId: string,
  userId: string,
  role: "STUDENT" | "INSTRUCTOR",
): Promise<{ deletable: boolean }> {
  if (role === "STUDENT") {
    const [enrollmentCount, examCount] = await Promise.all([
      db.enrollment.count({ where: { tenantId, studentId: userId } }),
      db.exam.count({ where: { tenantId, course: { studentId: userId } } }),
    ]);
    return { deletable: enrollmentCount === 0 && examCount === 0 };
  }
  const [classCount, examCount] = await Promise.all([
    db.classSession.count({
      where: {
        tenantId,
        OR: [{ instructorId: userId }, { createdById: userId }, { updatedById: userId }],
      },
    }),
    db.exam.count({
      where: {
        tenantId,
        OR: [{ instructorId: userId }, { createdById: userId }, { updatedById: userId }],
      },
    }),
  ]);
  return { deletable: classCount === 0 && examCount === 0 };
}

/**
 * Map a Supabase Auth error message (English, raw) to an i18n key the client
 * can translate via `useTranslatedError`. Falls back to a generic key for
 * unknown errors — the raw message is logged server-side for debugging.
 */
function mapSupabaseAuthError(message: string | undefined): string {
  if (!message) return "users.inviteFailed";
  const lower = message.toLowerCase();
  if (lower.includes("already been registered") || lower.includes("already exists")) {
    return "users.emailAlreadyRegistered";
  }
  if (lower.includes("invalid email")) {
    return "users.invalidEmail";
  }
  console.warn("[user] Unmapped Supabase auth error:", message);
  return "users.inviteFailed";
}

export const userRouter = router({
  list: roleProtectedProcedure(["ADMIN", "SECRETARY", "INSTRUCTOR"])
    .input(
      z.object({
        schoolId: z.string().uuid().optional(),
        role: z.enum(["ADMIN", "SECRETARY", "INSTRUCTOR", "STUDENT"]).optional(),
        status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const users = await ctx.db.user.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(input?.schoolId && { schoolId: input.schoolId }),
          ...(input?.role && { role: input.role }),
          ...(input?.status && { status: input.status }),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          qualifiedCategories: true,
          createdAt: true,
          school: { select: { id: true, name: true } },
          // Current course for students (used to display category badge in lists)
          studentCourses: {
            where: { status: "IN_PROGRESS" },
            select: { id: true, category: true },
            take: 1,
          },
        },
        orderBy: { name: "asc" },
      });

      // Merge email-confirmation status from Supabase Auth so the UI can
      // hide the "resend invite" button for users who already set a password.
      const confirmedById = new Map<string, boolean>();
      try {
        const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        for (const u of data?.users ?? []) {
          confirmedById.set(u.id, !!u.email_confirmed_at);
        }
      } catch (e) {
        console.error("[user.list] failed to fetch auth users", e);
      }

      return users.map(({ studentCourses, ...u }) => ({
        ...u,
        currentCategory: studentCourses[0]?.category ?? null,
        emailConfirmed: confirmedById.get(u.id) ?? false,
      }));
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
          qualifiedCategories: true,
          school: { select: { id: true, name: true } },
          createdAt: true,
        },
      });
    }),

  create: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(createUserSchema)
    .mutation(async ({ ctx, input }) => {
      // Only admins can create staff (admins or secretaries). Secretaries
      // are limited to creating students and instructors.
      if (
        ctx.user.role !== "ADMIN" &&
        (input.role === "ADMIN" || input.role === "SECRETARY")
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "auth.insufficientPermissions",
        });
      }

      // Verify the school belongs to this tenant
      const school = await ctx.db.school.findFirst({
        where: { id: input.schoolId, tenantId: ctx.tenantId },
        select: { id: true, subdomain: true },
      });

      if (!school) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "classes.schoolNotFound",
        });
      }

      // Build redirect URL pointing at the school's subdomain
      const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
      const tenantHost = `${school.subdomain}.${siteUrl.host}`;
      const redirectTo = `${siteUrl.protocol}//${tenantHost}/update-password`;

      // Invite user via email — they'll set their own password
      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.inviteUserByEmail(input.email, {
          redirectTo,
        });

      if (authError) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: mapSupabaseAuthError(authError.message),
        });
      }

      // Create Prisma user profile + initial student course (if applicable) atomically
      const user = await ctx.db.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            id: authData.user.id,
            tenantId: ctx.tenantId,
            schoolId: input.schoolId,
            email: input.email,
            name: input.name,
            phone: input.phone,
            role: input.role,
            qualifiedCategories:
              input.role === "INSTRUCTOR" ? input.qualifiedCategories ?? [] : [],
          },
          select: { id: true, name: true, email: true, role: true },
        });

        if (input.role === "STUDENT" && input.initialCategory) {
          await tx.studentCourse.create({
            data: {
              tenantId: ctx.tenantId,
              schoolId: input.schoolId,
              studentId: created.id,
              category: input.initialCategory,
            },
          });
        }

        return created;
      });

      return user;
    }),

  resendInvite: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: { email: true, school: { select: { subdomain: true } } },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "users.notFound" });
      }

      const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
      const tenantHost = `${user.school.subdomain}.${siteUrl.host}`;
      const redirectTo = `${siteUrl.protocol}//${tenantHost}/update-password`;

      // Sends a password recovery email via Supabase's built-in email
      const { error } = await supabaseAnon.auth.resetPasswordForEmail(user.email, {
        redirectTo,
      });

      if (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: mapSupabaseAuthError(error.message) });
      }

      return { success: true };
    }),

  update: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(updateUserSchema)
    .mutation(async ({ ctx, input }) => {
      // Only admins can edit staff (admins or secretaries) or promote anyone
      // to a staff role.
      if (ctx.user.role !== "ADMIN") {
        if (input.role === "ADMIN" || input.role === "SECRETARY") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "auth.insufficientPermissions",
          });
        }
        const target = await ctx.db.user.findFirst({
          where: { id: input.id, tenantId: ctx.tenantId },
          select: { role: true },
        });
        if (target && (target.role === "ADMIN" || target.role === "SECRETARY")) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "auth.insufficientPermissions",
          });
        }
      }

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
          ...(input.qualifiedCategories !== undefined && {
            qualifiedCategories: input.qualifiedCategories,
          }),
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

  // Hard-delete a STUDENT or INSTRUCTOR that has no business-meaningful FK
  // references. Used to clean up data-entry mistakes. Staff (ADMIN/SECRETARY)
  // are deactivate-only — their audit-trail FKs accumulate too quickly.
  //
  // Cascade on the schema removes Notification, PushSubscription, and
  // StudentCourse rows. Enrollments and Exams BLOCK deletion (the guard below)
  // because they represent real history that shouldn't disappear silently.
  delete: roleProtectedProcedure(["ADMIN"])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "users.cannotDeleteSelf" });
      }

      const target = await ctx.db.user.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: { id: true, role: true },
      });
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "users.notFound" });
      }
      if (target.role !== "STUDENT" && target.role !== "INSTRUCTOR") {
        throw new TRPCError({ code: "FORBIDDEN", message: "users.cannotDeleteStaff" });
      }

      const { deletable } = await computeDeletability(ctx.db, ctx.tenantId, target.id, target.role);
      if (!deletable) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "users.cannotDeleteHasData" });
      }

      // Delete Prisma row inside a transaction; if Supabase Auth delete fails,
      // throw to roll back so we don't leave a Prisma-less but still-loggable
      // auth row in an inconsistent state.
      await ctx.db.$transaction(async (tx) => {
        await tx.user.delete({ where: { id: target.id } });
        const { error } = await supabaseAdmin.auth.admin.deleteUser(target.id);
        if (error) {
          console.error("[user.delete] Supabase auth delete failed", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "users.deleteFailed" });
        }
      });

      return { success: true };
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

  /** Student profile with enrollment stats, course history and exam history */
  studentProfile: roleProtectedProcedure(["ADMIN", "SECRETARY", "INSTRUCTOR"])
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await syncClassStatuses(ctx.db, ctx.tenantId);

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
          studentCourses: {
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
                  location: true,
                  instructor: { select: { id: true, name: true } },
                },
                orderBy: { scheduledAt: "desc" },
              },
            },
            orderBy: { startedAt: "desc" },
          },
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
                  category: true,
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
      const now = new Date();
      const stats = {
        totalClasses: enrollments.length,
        totalAttended: enrollments.filter((e) => e.status === "ATTENDED").length,
        totalNoShow: enrollments.filter((e) => e.status === "NO_SHOW").length,
        theoryAttended: enrollments.filter((e) => e.status === "ATTENDED" && e.session.classType === "THEORY").length,
        practicalAttended: enrollments.filter((e) => e.status === "ATTENDED" && e.session.classType === "PRACTICAL").length,
        upcoming: enrollments.filter((e) => e.status === "ENROLLED" && new Date(e.session.startsAt) > now).length,
      };

      let emailConfirmed = false;
      try {
        const { data } = await supabaseAdmin.auth.admin.getUserById(student.id);
        emailConfirmed = !!data?.user?.email_confirmed_at;
      } catch {}

      const { deletable } = await computeDeletability(ctx.db, ctx.tenantId, student.id, "STUDENT");

      return { ...student, stats, emailConfirmed, deletable };
    }),

  /** Instructor profile with class stats and schedule */
  instructorProfile: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await syncClassStatuses(ctx.db, ctx.tenantId);

      const instructor = await ctx.db.user.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId, role: "INSTRUCTOR" },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          qualifiedCategories: true,
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

      let emailConfirmed = false;
      try {
        const { data } = await supabaseAdmin.auth.admin.getUserById(instructor.id);
        emailConfirmed = !!data?.user?.email_confirmed_at;
      } catch {}

      const { deletable } = await computeDeletability(ctx.db, ctx.tenantId, instructor.id, "INSTRUCTOR");

      return { ...instructor, stats, emailConfirmed, deletable };
    }),
});

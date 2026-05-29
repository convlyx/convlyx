import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createClient } from "@supabase/supabase-js";
import { router, protectedProcedure, roleProtectedProcedure } from "../trpc";
import { createUserSchema, updateUserSchema, listUsersSchema, listStudentEnrollmentsSchema, listInstructorSessionsSchema } from "@/lib/validations/user";
import { createNotification } from "../lib/notifications";
import { logger } from "@/lib/logger";

// Construction-time fallback: Supabase JS throws if URL/key are empty,
// which would crash the module on import in environments where env vars
// aren't set (CI integration tests). Real env values still win in prod;
// when the placeholder is used, every API call against this client will
// fail and is caught at the call site.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

// Admin client for creating auth users
const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Anon client used to trigger email-sending flows (e.g. password reset)
const supabaseAnon = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * Anonymized users have their email stripped to a placeholder of the form
 * `anonimizado-<id-prefix>@convlyx.invalid` (see `user.anonymize`). The
 * prefix + sentinel domain is unambiguous against any real address.
 */
function isAnonymizedEmail(email: string): boolean {
  return email.startsWith("anonimizado-") && email.endsWith("@convlyx.invalid");
}

/**
 * A STUDENT is deletable if they have no Enrollment and no Exam (via any of
 * their StudentCourses). An INSTRUCTOR is deletable if no ClassSession or
 * Exam references them — including audit FKs (createdBy/updatedBy).
 *
 * Cascade-only references (Notification, PushSubscription, StudentCourse for
 * students with no exams) do not block.
 */
async function computeDeletability(
  db: import("../lib/tenant-scope").DbClient,
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
  logger.warn("unmapped Supabase auth error", { message });
  return "users.inviteFailed";
}

export const userRouter = router({
  list: roleProtectedProcedure(["ADMIN", "SECRETARY", "INSTRUCTOR"])
    .input(listUsersSchema)
    .query(async ({ ctx, input }) => {
      const where = {
        tenantId: ctx.tenantId,
        ...(input?.schoolId && { schoolId: input.schoolId }),
        ...(input?.role
          ? { role: input.role }
          : input?.roles && input.roles.length > 0
            ? { role: { in: input.roles } }
            : {}),
        ...(input?.status && { status: input.status }),
        ...(input?.search && {
          OR: [
            { name: { contains: input.search, mode: "insensitive" as const } },
            { email: { contains: input.search, mode: "insensitive" as const } },
          ],
        }),
        ...(input?.category && {
          studentCourses: {
            some: { status: "IN_PROGRESS" as const, category: input.category },
          },
        }),
      };

      const select = {
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
          where: { status: "IN_PROGRESS" as const },
          select: { id: true, category: true },
          take: 1,
        },
      } as const;

      const paginated = !!(input?.page && input?.pageSize);
      const [usersRaw, total] = paginated
        ? await ctx.db.$transaction([
            ctx.db.user.findMany({
              where,
              select,
              orderBy: { name: "asc" },
              skip: (input!.page! - 1) * input!.pageSize!,
              take: input!.pageSize!,
            }),
            ctx.db.user.count({ where }),
          ])
        : await ctx.db.user.findMany({ where, select, orderBy: { name: "asc" } })
            .then((u) => [u, u.length] as const);

      // Merge email-confirmation status from Supabase Auth so the UI can
      // hide the "resend invite" button for users who already set a password.
      // NOTE: bounded at 1000 by Supabase Auth's `listUsers` — at scale this
      // will under-report. Acceptable for now; revisit when a tenant has
      // more than ~1000 auth users.
      const confirmedById = new Map<string, boolean>();
      try {
        const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        for (const u of data?.users ?? []) {
          confirmedById.set(u.id, !!u.email_confirmed_at);
        }
      } catch (e) {
        logger.error("user.list: failed to fetch auth users", { error: e });
      }

      const items = usersRaw.map(({ studentCourses, ...u }) => ({
        ...u,
        currentCategory: studentCourses[0]?.category ?? null,
        emailConfirmed: confirmedById.get(u.id) ?? false,
        anonymized: isAnonymizedEmail(u.email),
      }));

      return { items, total };
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

      // Pre-flight: does a user already exist in this tenant with this email?
      // `inviteUserByEmail` silently returns the existing auth user when the
      // email is already registered, and our subsequent `user.create` then
      // crashes on the `id` primary-key collision. Handle both branches
      // here so the admin gets a clear outcome instead of "unexpected error":
      //  - ACTIVE: refuse — the admin should use "Resend invite" instead.
      //  - INACTIVE: reactivate in place (covers the deactivate-then-re-add
      //    flow). Skip the invite — credentials already exist.
      const existing = await ctx.db.user.findFirst({
        where: { tenantId: ctx.tenantId, email: input.email },
        select: { id: true, status: true },
      });

      if (existing) {
        if (existing.status === "ACTIVE") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "users.emailAlreadyRegistered",
          });
        }

        const reactivated = await ctx.db.$transaction(async (tx) => {
          const updated = await tx.user.update({
            where: { id: existing.id },
            data: {
              status: "ACTIVE",
              schoolId: input.schoolId,
              role: input.role,
              name: input.name,
              phone: input.phone,
              qualifiedCategories:
                input.role === "INSTRUCTOR" ? input.qualifiedCategories ?? [] : [],
            },
            select: { id: true, name: true, email: true, role: true },
          });

          if (input.role === "STUDENT" && input.initialCategory) {
            // Only start a fresh course if there isn't already an in-progress
            // one for this category (the deactivated student may still have
            // one from before).
            const ongoing = await tx.studentCourse.findFirst({
              where: {
                tenantId: ctx.tenantId,
                studentId: existing.id,
                category: input.initialCategory,
                status: "IN_PROGRESS",
              },
              select: { id: true },
            });
            if (!ongoing) {
              await tx.studentCourse.create({
                data: {
                  tenantId: ctx.tenantId,
                  schoolId: input.schoolId,
                  studentId: existing.id,
                  category: input.initialCategory,
                },
              });
            }
          }

          return updated;
        });

        return reactivated;
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
        // Log the raw Supabase error before mapping — `mapSupabaseAuthError`
        // collapses unknown failures into `users.inviteFailed`, which hides
        // the actual SMTP / auth-service reason from the Vercel logs.
        logger.error("user.create: supabase invite failed", {
          email: input.email,
          status: authError.status,
          name: authError.name,
          code: authError.code,
          message: authError.message,
        });
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
        logger.error("user.resendInvite: supabase reset-password failed", {
          email: user.email,
          status: error.status,
          name: error.name,
          code: error.code,
          message: error.message,
        });
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

  deactivate: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "users.cannotDeactivateSelf",
        });
      }

      // Secretaries can deactivate students/instructors only — never other
      // ADMINs or SECRETARIES. Same rule as user.update.
      if (ctx.user.role !== "ADMIN") {
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
      }).catch((e) => logger.warn("notification dispatch failed", { error: e }));

      return result;
    }),

  activate: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Same SECRETARY guard as deactivate.
      if (ctx.user.role !== "ADMIN") {
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
        // 404 = auth row already gone, which is the desired end state.
        const { error } = await supabaseAdmin.auth.admin.deleteUser(target.id);
        if (error && error.status !== 404) {
          logger.error("user.delete: supabase auth delete failed", { error });
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "users.deleteFailed" });
        }
      });

      return { success: true };
    }),

  // GDPR Art. 17 ("right to be forgotten") companion to `delete`. For users
  // who can't be hard-deleted because they have history (enrollments, exams,
  // taught classes), this strips PII in place: name → "Anonimizado", email →
  // a unique placeholder, phone → null. Historical FK rows stay intact so
  // attendance records and exam history aren't silently rewritten — the
  // person is just unidentifiable.
  //
  // The Supabase Auth row is also deleted so the account can't log in again.
  // Same guards as `delete`: ADMIN-only, self forbidden, STUDENT/INSTRUCTOR
  // only (staff with audit-trail FKs would still be undeletable; if a staff
  // member ever needs anonymizing, lift the role check then).
  anonymize: roleProtectedProcedure(["ADMIN"])
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "users.cannotAnonymizeSelf" });
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

      // The User table is `@@unique([tenantId, email])`. The first 8 chars of
      // the user's UUID make the placeholder unique enough to avoid collisions
      // with other anonymized users in the same tenant, without dragging the
      // full UUID into anything an operator might still see in the UI.
      const placeholderEmail = `anonimizado-${target.id.slice(0, 8)}@convlyx.invalid`;

      await ctx.db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: target.id },
          data: {
            name: "Anonimizado",
            email: placeholderEmail,
            phone: null,
            status: "INACTIVE",
          },
        });
        // Notifications + push subscriptions hold name-adjacent personal data
        // and don't need to survive anonymization. Wipe them explicitly
        // (cascade rules only fire on user delete, which we're not doing).
        await tx.notification.deleteMany({ where: { userId: target.id } });
        await tx.pushSubscription.deleteMany({ where: { userId: target.id } });
        // Lock the auth account so the person can't log in again. If the
        // auth row is already gone (404), accept that as success — that's
        // the end state we want. Anything else rolls the transaction back
        // so the Prisma row stays identifiable.
        const { error } = await supabaseAdmin.auth.admin.deleteUser(target.id);
        if (error && error.status !== 404) {
          logger.error("user.anonymize: supabase auth delete failed", { error });
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "users.deleteFailed" });
        }
      });

      return { success: true };
    }),

  // GDPR Art. 15 ("right of access") — a complete machine-readable dump of
  // everything we hold about this user, scoped to the current tenant.
  // ADMIN-only; if you later want students to self-export, lift the role
  // check and add `id` validation against `ctx.user.id`.
  //
  // The shape is intentionally flat-ish JSON: one `profile` object plus
  // arrays for each related collection. Stable enough to hand to a data
  // subject as-is.
  exportData: roleProtectedProcedure(["ADMIN"])
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          qualifiedCategories: true,
          createdAt: true,
          updatedAt: true,
          school: { select: { id: true, name: true, subdomain: true } },
          tenant: { select: { id: true, name: true } },
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
                  examinerNotes: true,
                  instructor: { select: { id: true, name: true } },
                  createdAt: true,
                  updatedAt: true,
                },
                orderBy: { scheduledAt: "asc" },
              },
            },
            orderBy: { startedAt: "asc" },
          },
          enrollments: {
            select: {
              id: true,
              status: true,
              notes: true,
              enrolledAt: true,
              updatedAt: true,
              session: {
                select: {
                  id: true,
                  title: true,
                  classType: true,
                  category: true,
                  startsAt: true,
                  endsAt: true,
                  status: true,
                  instructor: { select: { id: true, name: true } },
                },
              },
            },
            orderBy: { enrolledAt: "asc" },
          },
          instructedSessions: {
            select: {
              id: true,
              title: true,
              classType: true,
              category: true,
              startsAt: true,
              endsAt: true,
              status: true,
              capacity: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { startsAt: "asc" },
          },
          accompaniedExams: {
            select: {
              id: true,
              type: true,
              scheduledAt: true,
              result: true,
              course: { select: { category: true, student: { select: { id: true, name: true } } } },
            },
            orderBy: { scheduledAt: "asc" },
          },
          notifications: {
            select: {
              id: true,
              type: true,
              title: true,
              message: true,
              data: true,
              read: true,
              createdAt: true,
            },
            orderBy: { createdAt: "asc" },
          },
          pushSubscriptions: {
            select: {
              id: true,
              endpoint: true,
              createdAt: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "users.notFound" });
      }

      // The relation arrays are stripped from the top-level profile so the
      // export has a clean `profile + arrays` shape; the arrays themselves
      // become sibling fields under their natural names.
      const {
        studentCourses,
        enrollments,
        instructedSessions,
        accompaniedExams,
        notifications,
        pushSubscriptions,
        ...profile
      } = user;

      return {
        exportedAt: new Date().toISOString(),
        format: "convlyx.gdpr.v1",
        profile,
        studentCourses,
        enrollments,
        instructedSessions,
        accompaniedExams,
        notifications,
        pushSubscriptions,
      };
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
      const user = await ctx.db.user.findFirst({
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

  /**
   * Identity + status + flags for the student detail page header. Kept
   * deliberately lean so it can land in ~50–100ms — the rest of the page
   * (stats/courses/history) fetches in parallel via the dedicated
   * `studentOverview` / `studentEnrollments` procedures.
   */
  studentHeader: roleProtectedProcedure(["ADMIN", "SECRETARY", "INSTRUCTOR"])
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
        },
      });

      if (!student) {
        throw new TRPCError({ code: "NOT_FOUND", message: "users.notFound" });
      }

      // emailConfirmed lives on the auth side — used by EditUserDialog to
      // show "send confirmation" affordances. Best-effort; failure is
      // non-fatal so a Supabase outage doesn't break the header.
      let emailConfirmed = false;
      try {
        const { data } = await supabaseAdmin.auth.admin.getUserById(student.id);
        emailConfirmed = !!data?.user?.email_confirmed_at;
      } catch {}

      const { deletable } = await computeDeletability(ctx.db, ctx.tenantId, student.id, "STUDENT");
      const anonymized = isAnonymizedEmail(student.email);

      return { ...student, emailConfirmed, deletable, anonymized };
    }),

  /**
   * Stats + courses (with per-category practical aggregates baked in).
   * Aggregates are computed server-side so the page doesn't need to ship
   * the full enrollment list just to render counters. Active-course
   * payloads also include the (bounded) list of practical enrollments
   * scoped to that category — they feed the per-course PDF export.
   */
  studentOverview: roleProtectedProcedure(["ADMIN", "SECRETARY", "INSTRUCTOR"])
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const studentExists = await ctx.db.user.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId, role: "STUDENT" },
        select: { id: true },
      });
      if (!studentExists) {
        throw new TRPCError({ code: "NOT_FOUND", message: "users.notFound" });
      }

      // Minimal enrollment slice for top-level stats — only the columns we
      // need to count. Avoids dragging instructor names, titles, etc.
      const enrollmentSlice = await ctx.db.enrollment.findMany({
        where: { studentId: input.id, tenantId: ctx.tenantId },
        select: {
          status: true,
          session: { select: { classType: true, category: true, startsAt: true } },
        },
      });

      const now = new Date();
      const stats = {
        totalClasses: enrollmentSlice.length,
        totalAttended: enrollmentSlice.filter((e) => e.status === "ATTENDED").length,
        totalNoShow: enrollmentSlice.filter((e) => e.status === "NO_SHOW").length,
        theoryAttended: enrollmentSlice.filter((e) => e.status === "ATTENDED" && e.session.classType === "THEORY").length,
        practicalAttended: enrollmentSlice.filter((e) => e.status === "ATTENDED" && e.session.classType === "PRACTICAL").length,
        upcoming: enrollmentSlice.filter((e) => e.status === "ENROLLED" && new Date(e.session.startsAt) > now).length,
      };

      const courses = await ctx.db.studentCourse.findMany({
        where: { studentId: input.id, tenantId: ctx.tenantId },
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
      });

      const activeCategories = courses
        .filter((c) => c.status === "IN_PROGRESS")
        .map((c) => c.category);

      // Practical enrollments scoped to active courses — bounded by the
      // student's enrollments in those categories (typically <50 per
      // course). Needed for the per-course PDF export's class history.
      const practicalEnrollments =
        activeCategories.length === 0
          ? []
          : await ctx.db.enrollment.findMany({
              where: {
                studentId: input.id,
                tenantId: ctx.tenantId,
                session: { classType: "PRACTICAL", category: { in: activeCategories } },
              },
              select: {
                status: true,
                session: {
                  select: {
                    title: true,
                    classType: true,
                    category: true,
                    startsAt: true,
                    endsAt: true,
                    instructor: { select: { name: true } },
                  },
                },
              },
              orderBy: { session: { startsAt: "desc" } },
            });

      const studentCourses = courses.map((course) => {
        const courseEnrollments =
          course.status === "IN_PROGRESS"
            ? practicalEnrollments.filter((e) => e.session.category === course.category)
            : [];
        const practicalAttended = courseEnrollments.filter((e) => e.status === "ATTENDED").length;
        const practicalMissed = courseEnrollments.filter((e) => e.status === "NO_SHOW").length;
        const practicalScheduled = courseEnrollments.filter((e) => e.status === "ENROLLED").length;
        return {
          ...course,
          practicalAttended,
          practicalMissed,
          practicalScheduled,
          practicalEnrollments: courseEnrollments,
        };
      });

      return { stats, studentCourses };
    }),

  /**
   * Paginated enrollment history. When `page` is omitted, returns the
   * full set (used by the PDF export which needs every row).
   */
  studentEnrollments: roleProtectedProcedure(["ADMIN", "SECRETARY", "INSTRUCTOR"])
    .input(listStudentEnrollmentsSchema)
    .query(async ({ ctx, input }) => {
      const { id, page, pageSize } = input;

      const studentExists = await ctx.db.user.findFirst({
        where: { id, tenantId: ctx.tenantId, role: "STUDENT" },
        select: { id: true },
      });
      if (!studentExists) {
        throw new TRPCError({ code: "NOT_FOUND", message: "users.notFound" });
      }

      const where = { studentId: id, tenantId: ctx.tenantId };
      const select = {
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
      } as const;
      const orderBy = { enrolledAt: "desc" } as const;

      if (page && pageSize) {
        const [items, total] = await Promise.all([
          ctx.db.enrollment.findMany({
            where,
            select,
            orderBy,
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          ctx.db.enrollment.count({ where }),
        ]);
        return { items, total };
      }

      const items = await ctx.db.enrollment.findMany({ where, select, orderBy });
      return { items, total: items.length };
    }),

  /** Student profile with enrollment stats, course history and exam history */
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
      const anonymized = isAnonymizedEmail(student.email);

      return { ...student, stats, emailConfirmed, deletable, anonymized };
    }),

  /**
   * Identity + status + flags for the instructor detail page header.
   * Lean enough to land in ~50–100ms — overview/sessions fetch in
   * parallel via dedicated procedures.
   */
  instructorHeader: roleProtectedProcedure(["ADMIN", "SECRETARY"])
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
          qualifiedCategories: true,
          createdAt: true,
          school: { select: { id: true, name: true } },
        },
      });

      if (!instructor) {
        throw new TRPCError({ code: "NOT_FOUND", message: "users.notFound" });
      }

      let emailConfirmed = false;
      try {
        const { data } = await supabaseAdmin.auth.admin.getUserById(instructor.id);
        emailConfirmed = !!data?.user?.email_confirmed_at;
      } catch {}

      const { deletable } = await computeDeletability(ctx.db, ctx.tenantId, instructor.id, "INSTRUCTOR");
      const anonymized = isAnonymizedEmail(instructor.email);

      return { ...instructor, emailConfirmed, deletable, anonymized };
    }),

  /**
   * Class stats for the instructor detail page. Computed from a lean
   * session slice (`status` + `classType` + `startsAt` + `endsAt`)
   * rather than syncing class statuses up-front — `completedClasses`
   * is derived by `endsAt < now AND status != CANCELLED` so the count
   * stays accurate regardless of whether the sync cron has run.
   */
  instructorOverview: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const instructorExists = await ctx.db.user.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId, role: "INSTRUCTOR" },
        select: { id: true },
      });
      if (!instructorExists) {
        throw new TRPCError({ code: "NOT_FOUND", message: "users.notFound" });
      }

      const [sessionSlice, totalStudentsTaught] = await Promise.all([
        ctx.db.classSession.findMany({
          where: { instructorId: input.id, tenantId: ctx.tenantId },
          select: { status: true, classType: true, startsAt: true, endsAt: true },
        }),
        ctx.db.enrollment.count({
          where: { tenantId: ctx.tenantId, session: { instructorId: input.id } },
        }),
      ]);

      const now = new Date();
      const stats = {
        totalClasses: sessionSlice.length,
        completedClasses: sessionSlice.filter(
          (s) => s.status !== "CANCELLED" && new Date(s.endsAt) < now,
        ).length,
        upcomingClasses: sessionSlice.filter(
          (s) => s.status !== "CANCELLED" && new Date(s.startsAt) > now,
        ).length,
        cancelledClasses: sessionSlice.filter((s) => s.status === "CANCELLED").length,
        theoryClasses: sessionSlice.filter((s) => s.classType === "THEORY").length,
        practicalClasses: sessionSlice.filter((s) => s.classType === "PRACTICAL").length,
        totalStudentsTaught,
      };

      return { stats };
    }),

  /** Paginated class history for the instructor detail page. */
  instructorSessions: roleProtectedProcedure(["ADMIN", "SECRETARY"])
    .input(listInstructorSessionsSchema)
    .query(async ({ ctx, input }) => {
      const { id, page, pageSize } = input;

      const instructorExists = await ctx.db.user.findFirst({
        where: { id, tenantId: ctx.tenantId, role: "INSTRUCTOR" },
        select: { id: true },
      });
      if (!instructorExists) {
        throw new TRPCError({ code: "NOT_FOUND", message: "users.notFound" });
      }

      const where = { instructorId: id, tenantId: ctx.tenantId };
      const select = {
        id: true,
        title: true,
        classType: true,
        startsAt: true,
        endsAt: true,
        status: true,
        capacity: true,
        _count: { select: { enrollments: true } },
      } as const;
      const orderBy = { startsAt: "desc" } as const;

      if (page && pageSize) {
        const [items, total] = await Promise.all([
          ctx.db.classSession.findMany({
            where,
            select,
            orderBy,
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          ctx.db.classSession.count({ where }),
        ]);
        return { items, total };
      }

      const items = await ctx.db.classSession.findMany({ where, select, orderBy });
      return { items, total: items.length };
    }),
});

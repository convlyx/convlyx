import { TRPCError } from "@trpc/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Prisma } from "@/generated/prisma/client";
import type { UserRole } from "@/generated/prisma/enums";
import { logger } from "@/lib/logger";
import type { CreateUserInput } from "@/lib/validations/user";
import type { TenantScopedDb } from "./tenant-scope";

/**
 * Translate a raw Supabase auth error message into one of our translatable
 * message keys. Unknown failures collapse to `users.inviteFailed` (and are
 * logged so the real reason still reaches the Vercel logs).
 */
export function mapSupabaseAuthError(message: string | undefined): string {
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

export type CreateUserResult = {
  user: { id: string; name: string; email: string; role: UserRole };
  /** Whether a brand-new account was invited, or an INACTIVE one reactivated. */
  outcome: "created" | "reactivated";
};

type CreateUserArgs = {
  /** Tenant-scoped Prisma client (e.g. `ctx.db`). */
  db: TenantScopedDb;
  /** Admin Supabase client used to send the invite email. */
  supabaseAdmin: SupabaseClient;
  tenantId: string;
  /** School already verified to belong to `tenantId`. */
  school: { id: string; subdomain: string };
  input: CreateUserInput;
};

/**
 * Create (or reactivate) a single user account: a Supabase Auth invite plus the
 * matching Prisma `User` row, with the optional initial `StudentCourse`.
 *
 * This is the shared core behind both `user.create` (single) and
 * `user.bulkCreate` (roster import). It handles the three production branches:
 *  1. Brand-new email → invite + insert.
 *  2. Email already ACTIVE in this tenant → CONFLICT (caller decides whether to
 *     surface or skip). No Supabase call.
 *  3. Email exists but INACTIVE in this tenant → reactivate in place. No invite.
 *
 * Throws `TRPCError` for expected failures so the global onError handler can
 * translate the message key.
 */
export async function createUserAccount({
  db,
  supabaseAdmin,
  tenantId,
  school,
  input,
}: CreateUserArgs): Promise<CreateUserResult> {
  // Pre-flight: does a user already exist in this tenant with this email?
  // `inviteUserByEmail` silently returns the existing auth user when the
  // email is already registered, and our subsequent insert then crashes on
  // the `id` primary-key collision. Handle both branches here so the caller
  // gets a clear outcome instead of "unexpected error":
  //  - ACTIVE: refuse — the admin should use "Resend invite" instead.
  //  - INACTIVE: reactivate in place (covers the deactivate-then-re-add flow).
  //    Skip the invite — credentials already exist.
  const existing = await db.user.findFirst({
    where: { tenantId, email: input.email },
    select: { id: true, status: true },
  });

  if (existing) {
    if (existing.status === "ACTIVE") {
      throw new TRPCError({
        code: "CONFLICT",
        message: "users.emailAlreadyRegistered",
      });
    }

    const reactivated = await db.$transaction(async (tx) => {
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

      // Phase 1 (Approach 1a): keep the Membership in sync with the reactivation
      // (role/school may differ from before). Create if missing, else update.
      const existingMembership = await tx.membership.findFirst({
        where: { tenantId, userId: existing.id },
        select: { id: true },
      });
      const membershipData = {
        schoolId: input.schoolId,
        role: input.role,
        status: "ACTIVE" as const,
        qualifiedCategories:
          input.role === "INSTRUCTOR" ? input.qualifiedCategories ?? [] : [],
      };
      if (existingMembership) {
        await tx.membership.updateMany({
          where: { tenantId, userId: existing.id },
          data: membershipData,
        });
      } else {
        await tx.membership.create({
          data: { tenantId, userId: existing.id, ...membershipData },
        });
      }

      if (input.role === "STUDENT" && input.initialCategory) {
        // Only start a fresh course if there isn't already an in-progress
        // one for this category (the deactivated student may still have
        // one from before).
        const ongoing = await tx.studentCourse.findFirst({
          where: {
            tenantId,
            studentId: existing.id,
            category: input.initialCategory,
            status: "IN_PROGRESS",
          },
          select: { id: true },
        });
        if (!ongoing) {
          await tx.studentCourse.create({
            data: {
              tenantId,
              schoolId: input.schoolId,
              studentId: existing.id,
              category: input.initialCategory,
            },
          });
        }
      }

      return updated;
    });

    return { user: reactivated, outcome: "reactivated" };
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
    logger.error("createUserAccount: supabase invite failed", {
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

  // Create Prisma user profile + initial student course (if applicable) atomically.
  // The pre-flight above catches in-tenant collisions; a P2002 on `id` here
  // means the email is registered in a different tenant (Supabase auth users
  // are global, so `inviteUserByEmail` returned an id already used by another
  // tenant's User row). Translate to the same friendly error.
  try {
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          id: authData.user.id,
          tenantId,
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

      // Phase 1 (Approach 1a): also create the per-tenant Membership — role/school
      // live here now. (User columns are still written above during the additive
      // phase; Phase 2 drops them.)
      await tx.membership.create({
        data: {
          tenantId,
          userId: created.id,
          schoolId: input.schoolId,
          role: input.role,
          qualifiedCategories:
            input.role === "INSTRUCTOR" ? input.qualifiedCategories ?? [] : [],
        },
      });

      if (input.role === "STUDENT" && input.initialCategory) {
        await tx.studentCourse.create({
          data: {
            tenantId,
            schoolId: input.schoolId,
            studentId: created.id,
            category: input.initialCategory,
          },
        });
      }

      return created;
    });

    return { user, outcome: "created" };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new TRPCError({
        code: "CONFLICT",
        message: "users.emailAlreadyRegistered",
      });
    }
    throw e;
  }
}

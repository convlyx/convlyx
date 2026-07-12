import { TRPCError } from "@trpc/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Prisma } from "@/generated/prisma/client";
import type { UserRole } from "@/generated/prisma/enums";
import { logger } from "@/lib/logger";
import type { CreateUserInput } from "@/lib/validations/user";
import { db as rawDb } from "@/server/db";
import type { TenantScopedDb } from "./tenant-scope";
import { recordNotification, dispatchPush, type PushJob } from "./notifications";
import { sendEmail, renderAddedToSchoolEmail } from "@/lib/email";

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
  school: { id: string; subdomain: string; name: string };
  input: CreateUserInput;
};

/**
 * Create (or reactivate, or cross-tenant add) a user account in a school.
 *
 * A person is a single **global identity**: one Supabase auth user maps to one
 * `User` row (`User.id == auth.users.id`), reachable from any tenant. What is
 * per-tenant is their `Membership` (role, school, status). So this handles four
 * cases off the caller's email:
 *
 *  1. No global identity yet → invite (Supabase) + create the `User` + a
 *     `Membership` + optional initial `StudentCourse`.
 *  2. Identity exists, already an ACTIVE member of THIS school → CONFLICT (use
 *     "resend invite" instead).
 *  3. Identity exists, has an INACTIVE membership here → reactivate it.
 *  4. Identity exists but is NOT a member here (they belong to another school)
 *     → silently ADD a `Membership` in this tenant and notify the person. No
 *     Supabase invite (they already have credentials), no new `User` row, and
 *     crucially **no signal to the admin that the person exists elsewhere** —
 *     the flow looks identical to inviting a brand-new email (privacy: a rival
 *     school's admin must not be able to discover a person is our customer).
 *
 * In cases 2–4 the person's global name/phone are left untouched — those are
 * edited via `user.update`, never silently overwritten by a re-invite.
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
  // Emails are case-insensitive: normalize so lookups, the Supabase invite, and
  // the stored row all agree (Supabase lowercases auth emails, so a mixed-case
  // User.email would otherwise never match its auth user).
  const email = input.email.trim().toLowerCase();

  // Global identity lookup (raw client — deliberately cross-tenant: "does this
  // person already exist on the platform?"). Matched case-insensitively so a
  // legacy mixed-case row is still found (otherwise we'd fall through to the
  // invite path and Supabase would reject it as "already registered"). Email is
  // globally unique in practice: Supabase auth is global and `User.id == auth
  // id`, so a second tenant can never mint a separate row for the same email.
  const globalUser = await rawDb.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, name: true },
  });

  if (globalUser) {
    const membership = await db.membership.findFirst({
      where: { tenantId, userId: globalUser.id },
      select: { id: true, status: true },
    });

    if (membership?.status === "ACTIVE") {
      throw new TRPCError({
        code: "CONFLICT",
        message: "users.emailAlreadyRegistered",
      });
    }

    const isReactivation = !!membership;
    const membershipData = {
      schoolId: input.schoolId,
      role: input.role,
      status: "ACTIVE" as const,
      qualifiedCategories:
        input.role === "INSTRUCTOR" ? input.qualifiedCategories ?? [] : [],
    };

    const jobs: (PushJob | null)[] = [];
    await db.$transaction(async (tx) => {
      if (membership) {
        await tx.membership.updateMany({
          where: { tenantId, userId: globalUser.id },
          data: membershipData,
        });
      } else {
        await tx.membership.create({
          data: { tenantId, userId: globalUser.id, ...membershipData },
        });
      }

      if (input.role === "STUDENT" && input.initialCategory) {
        // Only start a fresh course if there isn't already an in-progress one
        // for this category in this tenant.
        const ongoing = await tx.studentCourse.findFirst({
          where: {
            tenantId,
            studentId: globalUser.id,
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
              studentId: globalUser.id,
              category: input.initialCategory,
            },
          });
        }
      }

      // Notify the person only when they're newly added to this school (case 4)
      // — a same-tenant reactivation isn't a new relationship. It's their own
      // account, so this discloses nothing about any other tenant.
      if (!isReactivation) {
        jobs.push(
          await recordNotification(tx, {
            tenantId,
            userId: globalUser.id,
            type: "membership.added",
            titleKey: "notifications.addedToSchoolTitle",
            messageKey: "notifications.addedToSchool",
            params: { school: school.name },
          }),
        );
      }
    });
    dispatchPush(db, jobs);

    // Freshly added to a new school → email them a one-click magic link into
    // that school's subdomain (they already have a password, so no invite).
    // Best-effort: a link/email failure must never undo the completed add.
    if (!isReactivation) {
      try {
        const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
        const redirectTo = `${siteUrl.protocol}//${school.subdomain}.${siteUrl.host}/`;
        const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: { redirectTo },
        });
        if (linkErr) {
          logger.warn("createUserAccount: magic link generation failed", {
            message: linkErr.message,
          });
        }
        const actionUrl = linkData?.properties?.action_link ?? redirectTo;
        const mail = renderAddedToSchoolEmail({ schoolName: school.name, actionUrl });
        await sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text });
      } catch (e) {
        logger.error("createUserAccount: added-to-school email failed", {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return {
      user: {
        id: globalUser.id,
        name: globalUser.name,
        email,
        role: input.role,
      },
      outcome: isReactivation ? "reactivated" : "created",
    };
  }

  // ── Brand-new identity: invite + create User + Membership ──────────────────
  // Build redirect URL pointing at the school's subdomain
  const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
  const tenantHost = `${school.subdomain}.${siteUrl.host}`;
  const redirectTo = `${siteUrl.protocol}//${tenantHost}/update-password`;

  // Invite user via email — they'll set their own password
  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
    });

  if (authError) {
    // Log the raw Supabase error before mapping — `mapSupabaseAuthError`
    // collapses unknown failures into `users.inviteFailed`, which hides
    // the actual SMTP / auth-service reason from the Vercel logs.
    logger.error("createUserAccount: supabase invite failed", {
      email,
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

  // Create Prisma user profile + membership + initial student course atomically.
  // A P2002 here means the auth id already backs a User row (e.g. the email was
  // changed in auth so the global-email lookup above missed it) — translate to
  // the same friendly error.
  try {
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          id: authData.user.id,
          tenantId,
          schoolId: input.schoolId,
          email,
          name: input.name,
          phone: input.phone,
          role: input.role,
          qualifiedCategories:
            input.role === "INSTRUCTOR" ? input.qualifiedCategories ?? [] : [],
        },
        select: { id: true, name: true, email: true, role: true },
      });

      // Per-tenant Membership — role/school live here (Phase 2 drops the User
      // columns). Every creation path must write one, or the user is locked out.
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

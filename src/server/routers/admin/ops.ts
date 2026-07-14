import { TRPCError } from "@trpc/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { PrismaClient } from "@/generated/prisma/client";
import { router, adminProcedure } from "../../trpc";
import {
  adminTenantIdSchema,
  renameTenantSchema,
  updateSchoolSchema,
  listStaffSchema,
  setMembershipStatusSchema,
  resetPasswordSchema,
} from "@/lib/validations/admin";

async function requireTenant(db: PrismaClient, tenantId: string) {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } });
  if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "errors.notFound" });
  return tenant;
}

export const opsRouter = router({
  suspendTenant: adminProcedure.input(adminTenantIdSchema).mutation(async ({ ctx, input }) => {
    const tenant = await requireTenant(ctx.db, input.tenantId);
    await ctx.db.tenant.update({ where: { id: tenant.id }, data: { status: "INACTIVE" } });
    await ctx.audit({ action: "tenant.suspend", targetType: "tenant", targetId: tenant.id, metadata: { name: tenant.name } });
    return { status: "INACTIVE" as const };
  }),

  reactivateTenant: adminProcedure.input(adminTenantIdSchema).mutation(async ({ ctx, input }) => {
    const tenant = await requireTenant(ctx.db, input.tenantId);
    await ctx.db.tenant.update({ where: { id: tenant.id }, data: { status: "ACTIVE" } });
    await ctx.audit({ action: "tenant.reactivate", targetType: "tenant", targetId: tenant.id, metadata: { name: tenant.name } });
    return { status: "ACTIVE" as const };
  }),

  renameTenant: adminProcedure.input(renameTenantSchema).mutation(async ({ ctx, input }) => {
    const tenant = await requireTenant(ctx.db, input.tenantId);
    const updated = await ctx.db.tenant.update({
      where: { id: tenant.id },
      data: { name: input.name },
      select: { id: true, name: true },
    });
    await ctx.audit({ action: "tenant.update", targetType: "tenant", targetId: tenant.id, metadata: { from: tenant.name, to: updated.name } });
    return updated;
  }),

  updateSchool: adminProcedure.input(updateSchoolSchema).mutation(async ({ ctx, input }) => {
    const school = await ctx.db.school.findUnique({ where: { id: input.schoolId }, select: { id: true, tenantId: true } });
    if (!school) throw new TRPCError({ code: "NOT_FOUND", message: "errors.notFound" });
    await ctx.db.school.update({
      where: { id: school.id },
      data: {
        name: input.name,
        address: input.address ?? null,
        phone: input.phone ?? null,
        cancellationNoticeHours: input.cancellationNoticeHours,
        practicalSelfEnrollEnabled: input.practicalSelfEnrollEnabled,
        // timeZone deliberately omitted — fixed at creation.
      },
    });
    await ctx.audit({ action: "school.update", targetType: "school", targetId: school.id, metadata: { tenantId: school.tenantId, name: input.name } });
    return { id: school.id };
  }),

  listStaff: adminProcedure.input(listStaffSchema).query(async ({ ctx, input }) => {
    const rows = await ctx.db.membership.findMany({
      where: { schoolId: input.schoolId, role: { in: ["ADMIN", "SECRETARY"] } },
      select: { id: true, name: true, phone: true, role: true, status: true, user: { select: { email: true } } },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });
    return rows.map((r) => ({
      membershipId: r.id, name: r.name, email: r.user.email, phone: r.phone, role: r.role, status: r.status,
    }));
  }),

  setMembershipStatus: adminProcedure.input(setMembershipStatusSchema).mutation(async ({ ctx, input }) => {
    const m = await ctx.db.membership.findUnique({ where: { id: input.membershipId }, select: { id: true, tenantId: true } });
    if (!m) throw new TRPCError({ code: "NOT_FOUND", message: "errors.notFound" });
    await ctx.db.membership.update({ where: { id: m.id }, data: { status: input.status } });
    await ctx.audit({
      action: input.status === "ACTIVE" ? "membership.reactivate" : "membership.deactivate",
      targetType: "user",
      targetId: m.id,
      metadata: { tenantId: m.tenantId },
    });
    return { id: m.id, status: input.status };
  }),

  /**
   * Mint a Supabase recovery link for a staff member so an operator can help a
   * locked-out admin. Returns the link (immediate, SMTP-independent) for the
   * operator to relay; short-lived. Audited. The Supabase call is constructed
   * lazily so importing the router never depends on the service-role env.
   */
  sendPasswordReset: adminProcedure.input(resetPasswordSchema).mutation(async ({ ctx, input }) => {
    const m = await ctx.db.membership.findUnique({
      where: { id: input.membershipId },
      select: { userId: true, role: true, user: { select: { email: true } }, school: { select: { subdomain: true } } },
    });
    if (!m) throw new TRPCError({ code: "NOT_FOUND", message: "errors.notFound" });

    const supabaseAdmin = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const redirectTo = `https://${m.school.subdomain}.convlyx.com/update-password`;
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: m.user.email,
      options: { redirectTo },
    });
    if (error || !data?.properties?.action_link) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "errors.unexpected" });
    }

    await ctx.audit({
      action: "admin.password_reset",
      targetType: "user",
      targetId: m.userId,
      metadata: { email: m.user.email, role: m.role },
    });

    return { link: data.properties.action_link };
  }),
});

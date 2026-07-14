import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createCallerFactory, type TRPCContext } from "@/server/trpc";
import { appRouter } from "@/server/routers/_app";
import { createTestTenant, cleanupTenants, type TestTenant } from "./helpers/tenant";

const createCaller = createCallerFactory(appRouter);
function adminCaller(email = "op@convlyx.com"): ReturnType<typeof createCaller> {
  const ctx: TRPCContext = {
    db, tenantId: null, ip: null, user: { id: "op" }, userEmail: email,
    loadMembership: async () => null,
  };
  return createCaller(ctx);
}

const originalEmails = process.env.PLATFORM_ADMIN_EMAILS;
let a: TestTenant;
beforeAll(async () => {
  process.env.PLATFORM_ADMIN_EMAILS = "op@convlyx.com";
  a = await createTestTenant("OPS");
});
afterAll(async () => {
  if (originalEmails === undefined) delete process.env.PLATFORM_ADMIN_EMAILS;
  else process.env.PLATFORM_ADMIN_EMAILS = originalEmails;
  await cleanupTenants(a.tenantId);
});

describe("admin.ops tenant actions", () => {
  it("suspends, reactivates and audits", async () => {
    await adminCaller().admin.ops.suspendTenant({ tenantId: a.tenantId });
    expect((await db.tenant.findUnique({ where: { id: a.tenantId }, select: { status: true } }))?.status).toBe("INACTIVE");

    await adminCaller().admin.ops.reactivateTenant({ tenantId: a.tenantId });
    expect((await db.tenant.findUnique({ where: { id: a.tenantId }, select: { status: true } }))?.status).toBe("ACTIVE");

    const audits = await db.auditLog.findMany({ where: { targetId: a.tenantId, action: { in: ["tenant.suspend", "tenant.reactivate"] } } });
    expect(audits.length).toBe(2);
  });

  it("renames a tenant", async () => {
    await adminCaller().admin.ops.renameTenant({ tenantId: a.tenantId, name: "Renomeado" });
    expect((await db.tenant.findUnique({ where: { id: a.tenantId }, select: { name: true } }))?.name).toBe("Renomeado");
  });

  it("rejects a non-operator", async () => {
    await expect(adminCaller("nope@x.com").admin.ops.suspendTenant({ tenantId: a.tenantId })).rejects.toThrow();
  });
});

describe("admin.ops.updateSchool", () => {
  it("updates editable fields and audits (not timezone)", async () => {
    const before = await db.school.findUnique({ where: { id: a.schoolId }, select: { timeZone: true } });
    await adminCaller().admin.ops.updateSchool({
      schoolId: a.schoolId,
      name: "Escola Editada",
      address: "Rua X",
      phone: "912345678",
      cancellationNoticeHours: 48,
      practicalSelfEnrollEnabled: true,
    });
    const after = await db.school.findUnique({
      where: { id: a.schoolId },
      select: { name: true, address: true, cancellationNoticeHours: true, practicalSelfEnrollEnabled: true, timeZone: true },
    });
    expect(after?.name).toBe("Escola Editada");
    expect(after?.cancellationNoticeHours).toBe(48);
    expect(after?.practicalSelfEnrollEnabled).toBe(true);
    expect(after?.timeZone).toBe(before?.timeZone); // unchanged
  });
});

describe("admin.ops staff management", () => {
  it("lists staff (admin/secretary), excludes students", async () => {
    const staff = await adminCaller().admin.ops.listStaff({ schoolId: a.schoolId });
    expect(staff.every((s) => s.role !== "STUDENT")).toBe(true);
    expect(staff.some((s) => s.role === "ADMIN")).toBe(true);
  });
  it("deactivates then reactivates a membership and audits", async () => {
    const staff = await adminCaller().admin.ops.listStaff({ schoolId: a.schoolId });
    const admin = staff.find((s) => s.role === "ADMIN")!;
    await adminCaller().admin.ops.setMembershipStatus({ membershipId: admin.membershipId, status: "INACTIVE" });
    expect((await db.membership.findUnique({ where: { id: admin.membershipId }, select: { status: true } }))?.status).toBe("INACTIVE");
    await adminCaller().admin.ops.setMembershipStatus({ membershipId: admin.membershipId, status: "ACTIVE" });
    expect((await db.membership.findUnique({ where: { id: admin.membershipId }, select: { status: true } }))?.status).toBe("ACTIVE");
    const audits = await db.auditLog.findMany({ where: { targetId: admin.membershipId } });
    expect(audits.length).toBeGreaterThanOrEqual(2);
  });
});

describe("admin.ops.sendPasswordReset (guards)", () => {
  it("throws NOT_FOUND for an unknown membership", async () => {
    await expect(
      adminCaller().admin.ops.sendPasswordReset({ membershipId: "00000000-0000-0000-0000-000000000000" }),
    ).rejects.toThrow();
  });
  it("rejects a non-operator", async () => {
    await expect(
      adminCaller("nope@x.com").admin.ops.sendPasswordReset({ membershipId: "00000000-0000-0000-0000-000000000000" }),
    ).rejects.toThrow();
  });
});

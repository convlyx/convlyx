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
beforeAll(async () => { process.env.PLATFORM_ADMIN_EMAILS = "op@convlyx.com"; a = await createTestTenant("SUP"); });
afterAll(async () => {
  if (originalEmails === undefined) delete process.env.PLATFORM_ADMIN_EMAILS;
  else process.env.PLATFORM_ADMIN_EMAILS = originalEmails;
  await cleanupTenants(a.tenantId);
});

describe("admin.support.listStudents", () => {
  it("lists students only, and audits the access", async () => {
    const res = await adminCaller().admin.support.listStudents({ tenantId: a.tenantId, page: 1, pageSize: 20 });
    expect(res.total).toBeGreaterThanOrEqual(1);
    expect(res.items.some((s) => s.userId === a.studentUserId)).toBe(true);
    // The seed's admin/instructor are NOT students.
    expect(res.items.every((s) => s.userId !== a.adminUserId && s.userId !== a.instructorUserId)).toBe(true);
    const audits = await db.auditLog.findMany({ where: { action: "student.list_view", targetId: a.tenantId } });
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });
  it("rejects a non-operator", async () => {
    await expect(adminCaller("nope@x.com").admin.support.listStudents({ tenantId: a.tenantId, page: 1, pageSize: 20 })).rejects.toThrow();
  });
});

describe("admin.support.getStudent", () => {
  it("returns profile + courses + enrolments and audits the detail view", async () => {
    const res = await adminCaller().admin.support.getStudent({ tenantId: a.tenantId, studentUserId: a.studentUserId });
    expect(res.profile.userId).toBe(a.studentUserId);
    expect(Array.isArray(res.courses)).toBe(true);
    expect(res.courses.length).toBeGreaterThanOrEqual(1); // seed has one course
    expect(res.enrollments.length).toBeGreaterThanOrEqual(1); // seed has one enrolment
    const audits = await db.auditLog.findMany({ where: { action: "student.view_detail", targetId: a.studentUserId } });
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });
  it("throws NOT_FOUND for a non-member / non-student", async () => {
    await expect(adminCaller().admin.support.getStudent({ tenantId: a.tenantId, studentUserId: a.adminUserId })).rejects.toThrow();
  });
});

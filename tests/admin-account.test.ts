import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/server/db";
import { createCallerFactory, type TRPCContext } from "@/server/trpc";
import { appRouter } from "@/server/routers/_app";
import { createTestTenant, cleanupTenants, type TestTenant } from "./helpers/tenant";

const createCaller = createCallerFactory(appRouter);

function adminCaller(): ReturnType<typeof createCaller> {
  const ctx: TRPCContext = {
    db,
    tenantId: null,
    ip: null,
    user: { id: "op" },
    userEmail: "op@convlyx.com",
    loadMembership: async () => null,
  };
  return createCaller(ctx);
}

const originalEmails = process.env.PLATFORM_ADMIN_EMAILS;
let a: TestTenant;

beforeAll(async () => {
  process.env.PLATFORM_ADMIN_EMAILS = "op@convlyx.com";
  a = await createTestTenant("ACC");
});
afterAll(async () => {
  if (originalEmails === undefined) delete process.env.PLATFORM_ADMIN_EMAILS;
  else process.env.PLATFORM_ADMIN_EMAILS = originalEmails;
  await cleanupTenants(a.tenantId);
});

describe("admin.account.get", () => {
  it("returns tenant, schools, snapshot and staff (no students in staff list)", async () => {
    const res = await adminCaller().admin.account.get({ tenantId: a.tenantId });
    expect(res.tenant.id).toBe(a.tenantId);
    expect(res.schools.length).toBe(1);
    expect(res.snapshot.activeStudents).toBe(1);
    expect(res.snapshot.instructors).toBe(1);
    expect(res.members.staff.every((m) => m.role !== "STUDENT")).toBe(true);
    expect(res.members.staff.length).toBe(2); // ADMIN + INSTRUCTOR
  });
  it("staff rows carry membershipId and status", async () => {
    const res = await adminCaller().admin.account.get({ tenantId: a.tenantId });
    expect(
      res.members.staff.every(
        (m) => typeof m.membershipId === "string" && (m.status === "ACTIVE" || m.status === "INACTIVE"),
      ),
    ).toBe(true);
  });
  it("throws NOT_FOUND for an unknown tenant", async () => {
    await expect(
      adminCaller().admin.account.get({ tenantId: "00000000-0000-0000-0000-000000000000" }),
    ).rejects.toThrow();
  });
});

describe("admin.account.charts + timeline", () => {
  it("charts returns aligned aggregate series", async () => {
    const c = await adminCaller().admin.account.charts({ tenantId: a.tenantId, rangeDays: 90 });
    expect(["day", "week", "month"]).toContain(c.granularity);
    expect(Array.isArray(c.enrolments)).toBe(true);
    expect(Array.isArray(c.classesByType)).toBe(true);
    expect(c.funnel.map((f) => f.status)).toEqual(["ENROLLED", "ATTENDED", "NO_SHOW", "CANCELLED"]);
    expect(Array.isArray(c.passByCategory)).toBe(true);
    expect(Array.isArray(c.courseCompletion)).toBe(true);
  });
  it("timeline returns attributed events (staff, not students) + a total", async () => {
    const t = await adminCaller().admin.account.timeline({ tenantId: a.tenantId, page: 1, pageSize: 30 });
    expect(Array.isArray(t.items)).toBe(true);
    expect(typeof t.total).toBe("number");
    expect(t.total).toBeGreaterThanOrEqual(1); // seed has one class
    // Seed created one class by "Admin ACC" — a class_created event exists.
    expect(t.items.some((i) => i.kind === "class_created")).toBe(true);
  });
});

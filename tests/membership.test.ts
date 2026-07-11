import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/server/db";
import { withTenant } from "@/server/lib/tenant-scope";
import { createTestTenant, cleanupTenants, type TestTenant } from "./helpers/tenant";

let A: TestTenant, B: TestTenant;
afterAll(async () => {
  if (A) await cleanupTenants(A.tenantId, B.tenantId);
});

describe("Membership", () => {
  it("helper creates one membership per user with the right role/school", async () => {
    A = await createTestTenant("mem-a");
    B = await createTestTenant("mem-b");
    const rows = await db.membership.findMany({ where: { tenantId: A.tenantId } });
    expect(rows.length).toBe(3);
    const admin = rows.find((r) => r.userId === A.adminUserId)!;
    expect(admin.role).toBe("ADMIN");
    expect(admin.schoolId).toBe(A.schoolId);
    const instructor = rows.find((r) => r.userId === A.instructorUserId)!;
    expect(instructor.role).toBe("INSTRUCTOR");
  });

  it("is tenant-scoped: a scoped client for tenant A never sees tenant B's memberships", async () => {
    const scoped = withTenant(db, A.tenantId);
    const all = await scoped.membership.findMany({});
    expect(all.every((m) => m.tenantId === A.tenantId)).toBe(true);
    expect(all.some((m) => m.userId === B.adminUserId)).toBe(false);
  });
});

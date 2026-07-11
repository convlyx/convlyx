import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/server/db";
import { createCallerFactory } from "@/server/trpc";
import { appRouter } from "@/server/routers/_app";
import { createTestTenant, cleanupTenants, type TestTenant } from "./helpers/tenant";

const createCaller = createCallerFactory(appRouter);
let A: TestTenant;
afterAll(async () => {
  if (A) await cleanupTenants(A.tenantId);
});

describe("membership-aware protectedProcedure", () => {
  it("phase-1 bridge: falls back to the User row when no membership exists (no lockout)", async () => {
    A = await createTestTenant("mem-ctx");
    // Remove the admin's membership → simulate a user without one yet.
    await db.membership.deleteMany({ where: { tenantId: A.tenantId, userId: A.adminUserId } });
    // protectedProcedure must fall back to ctx.user, so the call still works.
    // (novidades.feed is a plain protectedProcedure — exercises the gate itself.)
    await expect(A.asAdmin.novidades.feed()).resolves.toBeDefined();
  });

  it("role checks read membership.role, not the caller-supplied ctx.user.role", async () => {
    // The caller CLAIMS ADMIN in ctx.user, but their Membership is STUDENT.
    const asStudentClaimingAdmin = createCaller({
      db,
      tenantId: A.tenantId,
      ip: null,
      user: { id: A.studentUserId, role: "ADMIN", tenantId: A.tenantId, schoolId: A.schoolId },
    });
    // user.list is ADMIN/SECRETARY-only. If the role check read ctx.user.role it
    // would (wrongly) allow this; reading membership.role (STUDENT) blocks it.
    await expect(asStudentClaimingAdmin.user.list()).rejects.toThrow();
  });
});

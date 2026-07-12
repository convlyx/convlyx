import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/server/db";
import { createCallerFactory } from "@/server/trpc";
import { appRouter } from "@/server/routers/_app";
import { createTestTenant, cleanupTenants, testLoadMembership, type TestTenant } from "./helpers/tenant";

const createCaller = createCallerFactory(appRouter);
let A: TestTenant;
afterAll(async () => {
  if (A) await cleanupTenants(A.tenantId);
});

describe("membership-aware protectedProcedure", () => {
  it("rejects a caller with no membership in the tenant (no fallback)", async () => {
    A = await createTestTenant("mem-ctx");
    // Sanity: with a membership, the call works.
    await expect(A.asAdmin.novidades.feed()).resolves.toBeDefined();
    // Remove the admin's membership → simulate a user who is not a member here.
    await db.membership.deleteMany({ where: { tenantId: A.tenantId, userId: A.adminUserId } });
    // Membership is authoritative: no membership ⇒ unauthorized, even though a
    // valid User row still exists (the phase-1 fallback has been removed).
    // (novidades.feed is a plain protectedProcedure — exercises the gate itself.)
    await expect(A.asAdmin.novidades.feed()).rejects.toThrow();
  });

  it("role checks read membership.role (ctx.user carries no role)", async () => {
    const asStudent = createCaller({
      db,
      tenantId: A.tenantId,
      ip: null,
      user: { id: A.studentUserId },
      loadMembership: testLoadMembership(A.studentUserId, A.tenantId),
    });
    // user.list is ADMIN/SECRETARY/INSTRUCTOR-only. The student's membership
    // role (STUDENT) is authoritative and blocks it.
    await expect(asStudent.user.list()).rejects.toThrow();
  });
});

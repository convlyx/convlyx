import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/server/db";
import { createCallerFactory } from "@/server/trpc";
import { appRouter } from "@/server/routers/_app";
import { createTestTenant, cleanupTenants, testLoadMembership, type TestTenant } from "./helpers/tenant";

const createCaller = createCallerFactory(appRouter);
let A: TestTenant;

beforeAll(async () => {
  A = await createTestTenant("user-write-mem");
});
afterAll(async () => {
  if (A) await cleanupTenants(A.tenantId);
});

function membership(userId: string) {
  return db.membership.findFirst({
    where: { tenantId: A.tenantId, userId },
    select: { role: true, schoolId: true, status: true, qualifiedCategories: true },
  });
}

describe("user mutations write through to Membership", () => {
  it("update writes role/school/qualifications to the Membership", async () => {
    // Promote the seeded STUDENT to INSTRUCTOR with new qualifications.
    await A.asAdmin.user.update({
      id: A.studentUserId,
      name: "Aluno Promovido",
      role: "INSTRUCTOR",
      schoolId: A.schoolId,
      qualifiedCategories: ["C"],
    });

    const m = await membership(A.studentUserId);
    expect(m?.role).toBe("INSTRUCTOR");
    expect(m?.qualifiedCategories).toEqual(["C"]);

    // Restore so later tests / cleanup see the original role.
    await A.asAdmin.user.update({
      id: A.studentUserId,
      name: "Aluno Promovido",
      role: "STUDENT",
      schoolId: A.schoolId,
    });
    expect((await membership(A.studentUserId))?.role).toBe("STUDENT");
  });

  it("deactivate/activate flip the Membership status", async () => {
    await A.asAdmin.user.deactivate({ id: A.instructorUserId });
    expect((await membership(A.instructorUserId))?.status).toBe("INACTIVE");

    await A.asAdmin.user.activate({ id: A.instructorUserId });
    expect((await membership(A.instructorUserId))?.status).toBe("ACTIVE");
  });

  it("the auth gate rejects a caller whose membership is INACTIVE", async () => {
    const asInstructor = createCaller({
      db,
      tenantId: A.tenantId,
      ip: null,
      user: { id: A.instructorUserId },
      loadMembership: testLoadMembership(A.instructorUserId, A.tenantId),
    });

    // Active → a plain protectedProcedure works.
    await expect(asInstructor.novidades.feed()).resolves.toBeDefined();

    // Deactivated in this tenant → membership.status INACTIVE → rejected,
    // even though the User row and the ctx claim otherwise.
    await A.asAdmin.user.deactivate({ id: A.instructorUserId });
    await expect(asInstructor.novidades.feed()).rejects.toThrow();

    await A.asAdmin.user.activate({ id: A.instructorUserId });
  });
});

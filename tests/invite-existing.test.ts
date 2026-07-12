import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/server/db";
import { cleanupTenants, createTestTenant, type TestTenant } from "./helpers/tenant";

/**
 * Cross-tenant identity (#3c-ii): inviting an email that already exists on the
 * platform (as a member of another school) must silently ADD a Membership in
 * this tenant — no new auth invite, no second User row, and no signal to the
 * admin that the person exists elsewhere. The person's global name is left
 * untouched, and they're notified they were added.
 */
describe("invite existing identity into a second school", () => {
  let A: TestTenant;
  let B: TestTenant;

  const sharedClient = createClient("https://placeholder.supabase.co", "key") as unknown as {
    auth: { admin: { inviteUserByEmail: ReturnType<typeof vi.fn> } };
  };
  const inviteMock = sharedClient.auth.admin.inviteUserByEmail;

  beforeAll(async () => {
    A = await createTestTenant("INV_A");
    B = await createTestTenant("INV_B");
  });

  afterAll(async () => {
    inviteMock.mockReset();
    await cleanupTenants(A.tenantId, B.tenantId);
  });

  test("adds a Membership in the second tenant without a new invite or User row", async () => {
    // Tenant A's seeded student is our existing global identity.
    const aStudent = await db.user.findUniqueOrThrow({
      where: { id: A.studentUserId },
      select: { email: true, name: true },
    });

    inviteMock.mockClear();

    // Admin of tenant B "invites" the same email (with a different name — which
    // must be ignored, since the global identity already exists).
    const result = await B.asAdmin.user.create({
      email: aStudent.email,
      name: "Nome Diferente",
      role: "STUDENT",
      schoolId: B.schoolId,
      initialCategory: "B",
    });

    // Same global identity — not a new user.
    expect(result.id).toBe(A.studentUserId);
    // No Supabase invite: they already have credentials.
    expect(inviteMock).not.toHaveBeenCalled();

    // A Membership now exists in tenant B.
    const memB = await db.membership.findFirst({
      where: { tenantId: B.tenantId, userId: A.studentUserId },
      select: { role: true, status: true, schoolId: true },
    });
    expect(memB?.status).toBe("ACTIVE");
    expect(memB?.role).toBe("STUDENT");
    expect(memB?.schoolId).toBe(B.schoolId);

    // Tenant A's membership is untouched.
    const memA = await db.membership.findFirst({
      where: { tenantId: A.tenantId, userId: A.studentUserId },
      select: { status: true },
    });
    expect(memA?.status).toBe("ACTIVE");

    // Global name NOT overwritten by the admin's entry.
    const row = await db.user.findUniqueOrThrow({
      where: { id: A.studentUserId },
      select: { name: true },
    });
    expect(row.name).toBe(aStudent.name);

    // Exactly one User row for the email (no duplicate identity).
    const rows = await db.user.findMany({
      where: { email: aStudent.email },
      select: { id: true },
    });
    expect(rows).toHaveLength(1);

    // The person is notified they were added to the new school.
    const notif = await db.notification.findFirst({
      where: { tenantId: B.tenantId, userId: A.studentUserId, type: "membership.added" },
      select: { id: true },
    });
    expect(notif).toBeTruthy();

    // An initial course was started in tenant B.
    const course = await db.studentCourse.findFirst({
      where: { tenantId: B.tenantId, studentId: A.studentUserId, category: "B" },
      select: { id: true },
    });
    expect(course).toBeTruthy();
  });
});

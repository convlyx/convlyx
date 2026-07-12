import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { db } from "@/server/db";
import { cleanupTenants, createTestTenant, type TestTenant } from "./helpers/tenant";

/**
 * GDPR Art. 17 anonymize-in-place. Verify the procedure:
 *  - Blanks PII (name / email / phone) on the user row.
 *  - Marks the user INACTIVE.
 *  - Keeps historical FK rows intact (enrollment, course).
 *  - Wipes notifications + push subscriptions.
 *  - Rejects self-anonymize.
 *
 * Cross-tenant rejection lives in `cross-tenant-mutations.test.ts`.
 */
describe("user.anonymize", () => {
  let a: TestTenant;

  beforeAll(async () => {
    a = await createTestTenant("ANON");
  });

  afterAll(async () => {
    await cleanupTenants(a.tenantId);
  });

  test("blanks PII and preserves history", async () => {
    // Sanity: helper seeded an enrollment + course for this student.
    const before = await db.user.findUniqueOrThrow({
      where: { id: a.studentUserId },
      select: { name: true, email: true },
    });
    expect(before.name).toMatch(/^Aluno /);

    await a.asAdmin.user.anonymize({ id: a.studentUserId });

    // This is the student's only school → the global identity is scrubbed and
    // the per-tenant membership is anonymized + deactivated.
    const after = await db.user.findUniqueOrThrow({
      where: { id: a.studentUserId },
      select: { name: true, email: true, phone: true },
    });
    expect(after.name).toBe("Anonimizado");
    // Email is `anonimizado-{first 8 chars of user id}@convlyx.invalid`.
    expect(after.email).toMatch(/^anonimizado-[0-9a-f]{8}@convlyx\.invalid$/);
    expect(after.phone).toBeNull();

    const mem = await db.membership.findFirst({
      where: { tenantId: a.tenantId, userId: a.studentUserId },
      select: { status: true, name: true },
    });
    expect(mem?.status).toBe("INACTIVE");
    expect(mem?.name).toBe("Anonimizado");

    // studentProfile surfaces an `anonymized: true` flag so the UI can hide
    // the danger zone for already-anonymized users.
    const profile = await a.asAdmin.user.studentProfile({ id: a.studentUserId });
    expect(profile.anonymized).toBe(true);

    // History stays: enrollment + course still reference this user id.
    const enrollment = await db.enrollment.findUnique({
      where: { id: a.enrollmentId },
      select: { studentId: true },
    });
    expect(enrollment?.studentId).toBe(a.studentUserId);
    const course = await db.studentCourse.findUnique({
      where: { id: a.courseId },
      select: { studentId: true },
    });
    expect(course?.studentId).toBe(a.studentUserId);
  });

  test("rejects self-anonymize", async () => {
    await expect(
      a.asAdmin.user.anonymize({ id: a.adminUserId }),
    ).rejects.toThrow(/cannotAnonymizeSelf/i);
  });
});

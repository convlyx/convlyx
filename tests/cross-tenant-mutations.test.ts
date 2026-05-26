import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { cleanupTenants, createTestTenant, type TestTenant } from "./helpers/tenant";

/**
 * Cross-tenant mutation rejection tests. For every mutation that takes an
 * entity ID, an actor in tenant A must not be able to touch tenant B's row
 * — even if they know its UUID. The procedure should respond with a
 * NOT_FOUND-shaped error and leave the target unmodified.
 */
describe("cross-tenant mutations", () => {
  let a: TestTenant;
  let b: TestTenant;

  beforeAll(async () => {
    [a, b] = await Promise.all([createTestTenant("MA"), createTestTenant("MB")]);
  });

  afterAll(async () => {
    await cleanupTenants(a.tenantId, b.tenantId);
  });

  test("enrollment.enroll rejects another tenant's sessionId", async () => {
    await expect(
      a.asAdmin.enrollment.enroll({
        sessionId: b.sessionId,
        studentId: a.studentUserId,
      }),
    ).rejects.toThrow(/notFound/i);
  });

  test("enrollment.enroll rejects another tenant's studentId", async () => {
    await expect(
      a.asAdmin.enrollment.enroll({
        sessionId: a.sessionId,
        studentId: b.studentUserId,
      }),
    ).rejects.toThrow(/notFound/i);
  });

  test("enrollment.cancel rejects another tenant's enrollmentId", async () => {
    await expect(
      a.asAdmin.enrollment.cancel({ enrollmentId: b.enrollmentId }),
    ).rejects.toThrow(/notFound/i);
  });

  test("enrollment.markAttendance rejects another tenant's enrollmentId", async () => {
    await expect(
      a.asAdmin.enrollment.markAttendance({
        enrollmentId: b.enrollmentId,
        status: "ATTENDED",
      }),
    ).rejects.toThrow(/notFound/i);
  });

  test("class.cancel rejects another tenant's classId", async () => {
    await expect(
      a.asAdmin.class.cancel({ id: b.sessionId }),
    ).rejects.toThrow(/notFound/i);
  });

  test("course.abandon rejects another tenant's courseId", async () => {
    await expect(
      a.asAdmin.course.abandon({ id: b.courseId }),
    ).rejects.toThrow(/notFound/i);
  });

  test("user.anonymize rejects another tenant's user id", async () => {
    await expect(
      a.asAdmin.user.anonymize({ id: b.studentUserId }),
    ).rejects.toThrow(/notFound/i);
  });
});

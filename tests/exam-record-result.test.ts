import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { db } from "@/server/db";
import { callerAs, cleanupTenants, createTestTenant, type TestTenant } from "./helpers/tenant";

/**
 * exam.recordResult — records PASSED/FAILED/NO_SHOW/CANCELLED, notifies the
 * student, and is one-shot (can't overwrite a recorded result). Instructors
 * are restricted to marking NO_SHOW on exams they personally accompany.
 */
describe("exam.recordResult", () => {
  let a: TestTenant;

  beforeAll(async () => {
    a = await createTestTenant("EXAMRES");
  });

  afterAll(async () => {
    await cleanupTenants(a.tenantId);
  });

  /** A SCHEDULED exam on the seeded student's course, optionally with an
   *  accompanying instructor. */
  async function seedExam(opts?: { instructorId?: string | null }) {
    const id = randomUUID();
    await db.exam.create({
      data: {
        id,
        tenantId: a.tenantId,
        schoolId: a.schoolId,
        courseId: a.courseId,
        type: "PRACTICAL",
        result: "SCHEDULED",
        scheduledAt: new Date(Date.now() + 86_400_000),
        instructorId: opts?.instructorId ?? null,
        createdById: a.adminUserId,
        updatedById: a.adminUserId,
      },
    });
    return id;
  }

  test("admin records PASSED and notifies the student", async () => {
    const id = await seedExam();
    const res = await a.asAdmin.exam.recordResult({ id, result: "PASSED" });
    expect(res.result).toBe("PASSED");

    const exam = await db.exam.findFirst({ where: { id } });
    expect(exam?.result).toBe("PASSED");

    const notif = await db.notification.findFirst({
      where: { tenantId: a.tenantId, userId: a.studentUserId, type: "exam.result" },
    });
    expect(notif).not.toBeNull();
  });

  test("cannot record a result twice", async () => {
    const id = await seedExam();
    await a.asAdmin.exam.recordResult({ id, result: "FAILED" });
    await expect(a.asAdmin.exam.recordResult({ id, result: "PASSED" })).rejects.toThrow(
      "exams.resultAlreadyRecorded",
    );
  });

  test("throws NOT_FOUND for an unknown exam", async () => {
    await expect(a.asAdmin.exam.recordResult({ id: randomUUID(), result: "PASSED" })).rejects.toThrow(
      "exams.notFound",
    );
  });

  test("an instructor cannot record a PASSED result", async () => {
    const id = await seedExam({ instructorId: a.instructorUserId });
    const asInstructor = callerAs(a, a.instructorUserId);
    await expect(asInstructor.exam.recordResult({ id, result: "PASSED" })).rejects.toThrow(
      "auth.insufficientPermissions",
    );
  });

  test("an instructor cannot mark NO_SHOW on an exam they don't accompany", async () => {
    const id = await seedExam({ instructorId: null });
    const asInstructor = callerAs(a, a.instructorUserId);
    await expect(asInstructor.exam.recordResult({ id, result: "NO_SHOW" })).rejects.toThrow(
      "auth.insufficientPermissions",
    );
  });

  test("an instructor can mark NO_SHOW on their own exam", async () => {
    const id = await seedExam({ instructorId: a.instructorUserId });
    const asInstructor = callerAs(a, a.instructorUserId);
    const res = await asInstructor.exam.recordResult({ id, result: "NO_SHOW" });
    expect(res.result).toBe("NO_SHOW");
  });
});

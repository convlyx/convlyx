import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { cleanupTenants, createTestTenant, type TestTenant } from "./helpers/tenant";

/**
 * Instructor double-booking checks. When creating a class or scheduling an
 * exam, the instructor must not already have something overlapping that
 * window — covers class-vs-class, class-vs-exam, and exam-vs-class cases.
 *
 * (Class-vs-class for one-off and recurring class creation already had
 * coverage in the routers — these tests add the new class-vs-exam and
 * exam-vs-class paths.)
 */
describe("instructor schedule conflicts", () => {
  let a: TestTenant;

  beforeAll(async () => {
    a = await createTestTenant("SCHED");
  });

  afterAll(async () => {
    await cleanupTenants(a.tenantId);
  });

  test("exam.schedule rejects when instructor has a class at the same time", async () => {
    // The tenant helper seeds a class for tomorrow, taught by instructorUserId.
    const classStartsAt = new Date(Date.now() + 86_400_000);

    await expect(
      a.asAdmin.exam.schedule({
        courseId: a.courseId,
        type: "THEORY",
        scheduledAt: classStartsAt.toISOString(),
        instructorId: a.instructorUserId,
      }),
    ).rejects.toThrow(/scheduleConflict/i);
  });

  test("class.create rejects when instructor has an exam at the same time", async () => {
    // Schedule an exam at +3 days first, then try to create a class overlapping it.
    const examTime = new Date(Date.now() + 3 * 86_400_000);
    await a.asAdmin.exam.schedule({
      courseId: a.courseId,
      type: "THEORY",
      scheduledAt: examTime.toISOString(),
      instructorId: a.instructorUserId,
    });

    await expect(
      a.asAdmin.class.create({
        schoolId: a.schoolId,
        classType: "THEORY",
        title: "Overlap",
        capacity: 20,
        instructorId: a.instructorUserId,
        startsAt: examTime.toISOString(),
        endsAt: new Date(examTime.getTime() + 3_600_000).toISOString(),
      }),
    ).rejects.toThrow(/scheduleConflict/i);
  });

});

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { db } from "@/server/db";
import { callerAs, cleanupTenants, createTestTenant, type TestTenant } from "./helpers/tenant";

/**
 * enrollment.cancel authorization + the student cancellation-notice window.
 * Students may only self-cancel their own ENROLLED rows, and only outside the
 * school's `cancellationNoticeHours`. Instructors are limited to their own
 * classes; staff can always remove.
 */
describe("enrollment.cancel notice window", () => {
  let a: TestTenant;

  beforeAll(async () => {
    a = await createTestTenant("CANCELNOTICE");
    // A 24h notice window for the whole suite.
    await db.school.update({
      where: { id: a.schoolId },
      data: { cancellationNoticeHours: 24 },
    });
  });

  afterAll(async () => {
    await cleanupTenants(a.tenantId);
  });

  /** A scheduled class `hoursFromNow` out, with the seeded student enrolled. */
  async function seedEnrolledClass(hoursFromNow: number, status: "ENROLLED" | "ATTENDED" = "ENROLLED") {
    const sessionId = randomUUID();
    const enrollmentId = randomUUID();
    const startsAt = new Date(Date.now() + hoursFromNow * 3600_000);
    await db.classSession.create({
      data: {
        id: sessionId,
        tenantId: a.tenantId,
        schoolId: a.schoolId,
        classType: "THEORY",
        title: "Aula",
        startsAt,
        endsAt: new Date(startsAt.getTime() + 3600_000),
        capacity: 20,
        instructorId: a.instructorUserId,
        createdById: a.adminUserId,
        updatedById: a.adminUserId,
      },
    });
    await db.enrollment.create({
      data: { id: enrollmentId, tenantId: a.tenantId, schoolId: a.schoolId, sessionId, studentId: a.studentUserId, status },
    });
    return { sessionId, enrollmentId };
  }

  test("student can self-cancel comfortably outside the notice window", async () => {
    const { enrollmentId } = await seedEnrolledClass(48); // 48h out, window is 24h
    const asStudent = callerAs(a, a.studentUserId);
    const res = await asStudent.enrollment.cancel({ enrollmentId });
    expect(res.success).toBe(true);
    const row = await db.enrollment.findFirst({ where: { id: enrollmentId } });
    expect(row).toBeNull();
  });

  test("student is blocked from self-cancelling inside the notice window", async () => {
    const { enrollmentId } = await seedEnrolledClass(2); // 2h out, inside 24h window
    const asStudent = callerAs(a, a.studentUserId);
    await expect(asStudent.enrollment.cancel({ enrollmentId })).rejects.toThrow(
      "enrollments.cancellationTooLate",
    );
  });

  test("student cannot cancel a non-active (ATTENDED) enrolment", async () => {
    const { enrollmentId } = await seedEnrolledClass(48, "ATTENDED");
    const asStudent = callerAs(a, a.studentUserId);
    await expect(asStudent.enrollment.cancel({ enrollmentId })).rejects.toThrow(
      "enrollments.notActive",
    );
  });

  test("student cannot cancel someone else's enrolment", async () => {
    const { enrollmentId } = await seedEnrolledClass(48);
    // A second student in the same tenant tries to cancel the seeded student's row.
    const otherId = randomUUID();
    await db.user.create({ data: { id: otherId, email: `other-${randomUUID().slice(0, 8)}@test.local`, name: "Outro" } });
    await db.membership.create({
      data: { tenantId: a.tenantId, userId: otherId, schoolId: a.schoolId, role: "STUDENT", name: "Outro" },
    });
    const asOther = callerAs(a, otherId);
    await expect(asOther.enrollment.cancel({ enrollmentId })).rejects.toThrow(
      "auth.insufficientPermissions",
    );
  });

  test("instructor cannot cancel enrolments in a class they don't teach", async () => {
    const { enrollmentId, sessionId } = await seedEnrolledClass(48);
    // Reassign the class to a different instructor so the seeded one is a stranger to it.
    const otherInstructor = randomUUID();
    await db.user.create({ data: { id: otherInstructor, email: `inst-${randomUUID().slice(0, 8)}@test.local`, name: "Instrutor 2" } });
    await db.membership.create({
      data: { tenantId: a.tenantId, userId: otherInstructor, schoolId: a.schoolId, role: "INSTRUCTOR", qualifiedCategories: ["B"], name: "Instrutor 2" },
    });
    await db.classSession.update({ where: { id: sessionId }, data: { instructorId: otherInstructor } });

    const asInstructor = callerAs(a, a.instructorUserId);
    await expect(asInstructor.enrollment.cancel({ enrollmentId })).rejects.toThrow(
      "auth.insufficientPermissions",
    );
  });

  test("admin can remove an enrolment regardless of the notice window", async () => {
    const { enrollmentId } = await seedEnrolledClass(1); // inside the window — irrelevant for staff
    const res = await a.asAdmin.enrollment.cancel({ enrollmentId });
    expect(res.success).toBe(true);
    // Removed by staff → the student gets a cancellation notification.
    const notif = await db.notification.findFirst({
      where: { tenantId: a.tenantId, userId: a.studentUserId, type: "enrollment.cancelled" },
    });
    expect(notif).not.toBeNull();
  });
});

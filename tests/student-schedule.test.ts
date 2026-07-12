import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { db } from "@/server/db";
import { cleanupTenants, createTestTenant, type TestTenant } from "./helpers/tenant";

/**
 * Students must not be double-booked. The tenant helper seeds a THEORY class
 * tomorrow with `studentUserId` already enrolled — that's the student's
 * existing commitment. Each test sets up a second, overlapping commitment and
 * asserts it's rejected.
 *
 * Where the booking goes through a path that also checks the instructor
 * (`class.create`), we use a *second, free* instructor so the instructor guard
 * can't mask the student guard we're actually exercising.
 */
describe("student schedule conflicts", () => {
  let a: TestTenant;
  /** A second instructor with no bookings, used to isolate the student check. */
  let freeInstructorId: string;
  /** Start of the seeded class (tomorrow), 1h long. */
  let classStartsAt: Date;

  beforeAll(async () => {
    a = await createTestTenant("STUSCHED");
    classStartsAt = new Date(Date.now() + 86_400_000);

    freeInstructorId = randomUUID();
    await db.user.create({
      data: {
        id: freeInstructorId,
        email: `free-instructor-${randomUUID().slice(0, 8)}@test.local`,
        name: "Instrutor Livre",
      },
    });
    // Instructor verification in class.create is Membership-driven now.
    await db.membership.create({
      data: {
        tenantId: a.tenantId,
        userId: freeInstructorId,
        name: "Instrutor Livre",
        schoolId: a.schoolId,
        role: "INSTRUCTOR",
        qualifiedCategories: ["B"],
      },
    });
  });

  afterAll(async () => {
    await cleanupTenants(a.tenantId);
  });

  test("enrollment.enroll rejects when the student already has a class at the same time", async () => {
    // A second class overlapping the seeded one, taught by the free instructor
    // (inserted directly so its own creation doesn't run the student check).
    const overlapId = randomUUID();
    await db.classSession.create({
      data: {
        id: overlapId,
        tenantId: a.tenantId,
        schoolId: a.schoolId,
        classType: "THEORY",
        title: "Aula sobreposta",
        startsAt: classStartsAt,
        endsAt: new Date(classStartsAt.getTime() + 3_600_000),
        capacity: 20,
        instructorId: freeInstructorId,
        createdById: a.adminUserId,
        updatedById: a.adminUserId,
      },
    });

    await expect(
      a.asAdmin.enrollment.enroll({ sessionId: overlapId, studentId: a.studentUserId }),
    ).rejects.toThrow(/scheduleConflict/i);
  });

  test("class.create rejects assigning a student who is already booked", async () => {
    await expect(
      a.asAdmin.class.create({
        schoolId: a.schoolId,
        classType: "THEORY",
        title: "Nova aula sobreposta",
        capacity: 20,
        instructorId: freeInstructorId,
        startsAt: classStartsAt.toISOString(),
        endsAt: new Date(classStartsAt.getTime() + 3_600_000).toISOString(),
        studentIds: [a.studentUserId],
      }),
    ).rejects.toThrow(/scheduleConflict/i);
  });

  test("exam.schedule rejects when the student has a class at the same time", async () => {
    await expect(
      a.asAdmin.exam.schedule({
        courseId: a.courseId,
        type: "THEORY",
        scheduledAt: classStartsAt.toISOString(),
        // No instructor → isolates the student conflict from the instructor one.
      }),
    ).rejects.toThrow(/scheduleConflict/i);
  });

  test("enrollment.enroll rejects when the student has an exam at the same time", async () => {
    // Schedule an exam at +3 days (a slot the student is otherwise free for),
    // then a class overlapping it and try to enroll the student.
    const examTime = new Date(Date.now() + 3 * 86_400_000);
    await a.asAdmin.exam.schedule({
      courseId: a.courseId,
      type: "THEORY",
      scheduledAt: examTime.toISOString(),
    });

    const overlapId = randomUUID();
    await db.classSession.create({
      data: {
        id: overlapId,
        tenantId: a.tenantId,
        schoolId: a.schoolId,
        classType: "THEORY",
        title: "Aula sobre o exame",
        startsAt: examTime,
        endsAt: new Date(examTime.getTime() + 3_600_000),
        capacity: 20,
        instructorId: freeInstructorId,
        createdById: a.adminUserId,
        updatedById: a.adminUserId,
      },
    });

    await expect(
      a.asAdmin.enrollment.enroll({ sessionId: overlapId, studentId: a.studentUserId }),
    ).rejects.toThrow(/scheduleConflict/i);
  });

  test("enrollment.enroll succeeds at a non-overlapping time", async () => {
    // Two days out, well clear of the seeded class.
    const freeStart = new Date(Date.now() + 2 * 86_400_000);
    const freeClassId = randomUUID();
    await db.classSession.create({
      data: {
        id: freeClassId,
        tenantId: a.tenantId,
        schoolId: a.schoolId,
        classType: "THEORY",
        title: "Aula sem sobreposição",
        startsAt: freeStart,
        endsAt: new Date(freeStart.getTime() + 3_600_000),
        capacity: 20,
        instructorId: freeInstructorId,
        createdById: a.adminUserId,
        updatedById: a.adminUserId,
      },
    });

    const result = await a.asAdmin.enrollment.enroll({
      sessionId: freeClassId,
      studentId: a.studentUserId,
    });
    expect(result.status).toBe("ENROLLED");
  });
});

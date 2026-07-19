import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { db } from "@/server/db";
import { callerAs, cleanupTenants, createTestTenant, type TestTenant } from "./helpers/tenant";
import type { LicenseCategory } from "@/lib/license-categories";

/**
 * Student self-enrollment eligibility matrix (enrollment.enroll). Staff enrol
 * operationally and bypass these rules — only STUDENT self-enrolment is gated:
 *   - must have an in-progress course              (noActiveCourse)
 *   - theory only until the theory exam is passed  (theoryAlreadyPassed)
 *   - practical needs the per-school opt-in         (practicalSelfEnrollDisabled)
 *   - practical must match the active category      (categoryMismatch)
 *   - capacity + duplicate guards                   (classFull / alreadyEnrolled)
 *
 * Each scenario seeds its own student (so passed-exam / course state never
 * leaks across tests) and a non-overlapping session (so the schedule-conflict
 * guard can't mask the eligibility rule under test).
 */
describe("enrollment.enroll student eligibility", () => {
  let a: TestTenant;

  beforeAll(async () => {
    a = await createTestTenant("ENROLELIG");
  });

  afterAll(async () => {
    await cleanupTenants(a.tenantId);
  });

  /** Fresh student; pass category:null to leave them with no course. */
  async function seedStudent(category: LicenseCategory | null = "B") {
    const userId = randomUUID();
    const suffix = randomUUID().slice(0, 8);
    await db.user.create({
      data: { id: userId, email: `elig-${suffix}@test.local`, name: `Aluno ${suffix}` },
    });
    await db.membership.create({
      data: { tenantId: a.tenantId, userId, schoolId: a.schoolId, role: "STUDENT", name: `Aluno ${suffix}` },
    });
    let courseId: string | null = null;
    if (category !== null) {
      courseId = randomUUID();
      await db.studentCourse.create({
        data: { id: courseId, tenantId: a.tenantId, schoolId: a.schoolId, studentId: userId, category },
      });
    }
    return { userId, courseId, caller: callerAs(a, userId) };
  }

  async function seedSession(opts: {
    classType: "THEORY" | "PRACTICAL";
    category?: LicenseCategory;
    hoursFromNow?: number;
    capacity?: number;
  }) {
    const id = randomUUID();
    const startsAt = new Date(Date.now() + (opts.hoursFromNow ?? 48) * 3600_000);
    const endsAt = new Date(startsAt.getTime() + 3600_000);
    await db.classSession.create({
      data: {
        id,
        tenantId: a.tenantId,
        schoolId: a.schoolId,
        classType: opts.classType,
        category: opts.classType === "PRACTICAL" ? (opts.category ?? "B") : null,
        title: "Aula",
        startsAt,
        endsAt,
        capacity: opts.capacity ?? 20,
        instructorId: a.instructorUserId,
        createdById: a.adminUserId,
        updatedById: a.adminUserId,
      },
    });
    return { id, startsAt, endsAt };
  }

  async function setSelfEnroll(enabled: boolean) {
    await db.school.update({
      where: { id: a.schoolId },
      data: { practicalSelfEnrollEnabled: enabled },
    });
  }

  test("rejects a student with no active course", async () => {
    const s = await seedStudent(null);
    const sess = await seedSession({ classType: "THEORY" });
    await expect(s.caller.enrollment.enroll({ sessionId: sess.id })).rejects.toThrow(
      "enrollments.noActiveCourse",
    );
  });

  test("allows theory self-enrolment with an active course", async () => {
    const s = await seedStudent("B");
    const sess = await seedSession({ classType: "THEORY" });
    const res = await s.caller.enrollment.enroll({ sessionId: sess.id });
    expect(res.status).toBe("ENROLLED");
  });

  test("blocks theory once the theory exam for that category is passed", async () => {
    const s = await seedStudent("B");
    await db.exam.create({
      data: {
        tenantId: a.tenantId,
        schoolId: a.schoolId,
        courseId: s.courseId!,
        type: "THEORY",
        result: "PASSED",
        scheduledAt: new Date(Date.now() - 86_400_000),
        createdById: a.adminUserId,
        updatedById: a.adminUserId,
      },
    });
    const sess = await seedSession({ classType: "THEORY" });
    await expect(s.caller.enrollment.enroll({ sessionId: sess.id })).rejects.toThrow(
      "enrollments.theoryAlreadyPassed",
    );
  });

  test("blocks practical self-enrolment when the school has it disabled", async () => {
    await setSelfEnroll(false);
    const s = await seedStudent("B");
    const sess = await seedSession({ classType: "PRACTICAL", category: "B" });
    await expect(s.caller.enrollment.enroll({ sessionId: sess.id })).rejects.toThrow(
      "enrollments.practicalSelfEnrollDisabled",
    );
  });

  test("blocks practical self-enrolment for a mismatched category", async () => {
    await setSelfEnroll(true);
    const s = await seedStudent("B");
    const sess = await seedSession({ classType: "PRACTICAL", category: "A" });
    await expect(s.caller.enrollment.enroll({ sessionId: sess.id })).rejects.toThrow(
      "enrollments.categoryMismatch",
    );
  });

  test("allows practical self-enrolment when enabled and the category matches", async () => {
    await setSelfEnroll(true);
    const s = await seedStudent("B");
    const sess = await seedSession({ classType: "PRACTICAL", category: "B" });
    const res = await s.caller.enrollment.enroll({ sessionId: sess.id });
    expect(res.status).toBe("ENROLLED");
  });

  test("rejects a full class", async () => {
    const s = await seedStudent("B");
    const sess = await seedSession({ classType: "THEORY", capacity: 1 });
    // Fill the single seat with another student.
    await db.enrollment.create({
      data: {
        tenantId: a.tenantId,
        schoolId: a.schoolId,
        sessionId: sess.id,
        studentId: a.studentUserId,
      },
    });
    await expect(s.caller.enrollment.enroll({ sessionId: sess.id })).rejects.toThrow(
      "enrollments.classFull",
    );
  });

  test("rejects a duplicate enrolment", async () => {
    const s = await seedStudent("B");
    const sess = await seedSession({ classType: "THEORY" });
    await s.caller.enrollment.enroll({ sessionId: sess.id });
    await expect(s.caller.enrollment.enroll({ sessionId: sess.id })).rejects.toThrow(
      "enrollments.alreadyEnrolled",
    );
  });

  test("staff bypass the rules — admin enrols into a self-enroll-disabled practical", async () => {
    await setSelfEnroll(false);
    const s = await seedStudent("B");
    const sess = await seedSession({ classType: "PRACTICAL", category: "B" });
    const res = await a.asAdmin.enrollment.enroll({ sessionId: sess.id, studentId: s.userId });
    expect(res.status).toBe("ENROLLED");
  });
});

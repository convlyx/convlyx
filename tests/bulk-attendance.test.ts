import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { db } from "@/server/db";
import { callerAs, cleanupTenants, createTestTenant, type TestTenant } from "./helpers/tenant";

/**
 * Bulk attendance:
 *   - bulkMarkAttendance: set every ENROLLED row in a session to one status.
 *   - bulkSetAttendance: per-enrolment statuses in one round-trip.
 * Both are scoped to the tenant and, for instructors, to their own classes.
 */
describe("bulk attendance", () => {
  let a: TestTenant;

  beforeAll(async () => {
    a = await createTestTenant("BULKATT");
  });

  afterAll(async () => {
    await cleanupTenants(a.tenantId);
  });

  /** A class with `n` enrolled students (fresh users), taught by the seeded
   *  instructor unless overridden. Returns the session id + enrolment ids. */
  async function seedClassWithStudents(n: number, instructorId = a.instructorUserId) {
    const sessionId = randomUUID();
    const startsAt = new Date(Date.now() - 3600_000); // already started, ready for attendance
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
        instructorId,
        createdById: a.adminUserId,
        updatedById: a.adminUserId,
      },
    });
    const enrollmentIds: string[] = [];
    for (let i = 0; i < n; i++) {
      const userId = randomUUID();
      await db.user.create({ data: { id: userId, email: `bulk-${randomUUID().slice(0, 8)}@test.local`, name: `Aluno ${i}` } });
      await db.membership.create({
        data: { tenantId: a.tenantId, userId, schoolId: a.schoolId, role: "STUDENT", name: `Aluno ${i}` },
      });
      const enrollmentId = randomUUID();
      await db.enrollment.create({
        data: { id: enrollmentId, tenantId: a.tenantId, schoolId: a.schoolId, sessionId, studentId: userId },
      });
      enrollmentIds.push(enrollmentId);
    }
    return { sessionId, enrollmentIds };
  }

  test("bulkMarkAttendance flips every ENROLLED row to the given status", async () => {
    const { sessionId, enrollmentIds } = await seedClassWithStudents(3);
    const res = await a.asAdmin.enrollment.bulkMarkAttendance({ sessionId, status: "ATTENDED" });
    expect(res.count).toBe(3);
    const rows = await db.enrollment.findMany({ where: { id: { in: enrollmentIds } }, select: { status: true } });
    expect(rows.every((r) => r.status === "ATTENDED")).toBe(true);
  });

  test("bulkMarkAttendance rejects an instructor for a class they don't teach", async () => {
    const otherInstructor = randomUUID();
    await db.user.create({ data: { id: otherInstructor, email: `inst-${randomUUID().slice(0, 8)}@test.local`, name: "Instrutor 2" } });
    await db.membership.create({
      data: { tenantId: a.tenantId, userId: otherInstructor, schoolId: a.schoolId, role: "INSTRUCTOR", qualifiedCategories: ["B"], name: "Instrutor 2" },
    });
    const { sessionId } = await seedClassWithStudents(2, otherInstructor);
    const asInstructor = callerAs(a, a.instructorUserId);
    await expect(asInstructor.enrollment.bulkMarkAttendance({ sessionId, status: "ATTENDED" })).rejects.toThrow(
      "classes.notFound",
    );
  });

  test("bulkSetAttendance applies per-enrolment statuses", async () => {
    const { sessionId, enrollmentIds } = await seedClassWithStudents(2);
    await a.asAdmin.enrollment.bulkSetAttendance({
      sessionId,
      entries: [
        { enrollmentId: enrollmentIds[0], status: "ATTENDED" },
        { enrollmentId: enrollmentIds[1], status: "NO_SHOW" },
      ],
    });
    const first = await db.enrollment.findFirst({ where: { id: enrollmentIds[0] } });
    const second = await db.enrollment.findFirst({ where: { id: enrollmentIds[1] } });
    expect(first?.status).toBe("ATTENDED");
    expect(second?.status).toBe("NO_SHOW");
  });

  test("bulkSetAttendance rejects an enrolment from a different session", async () => {
    const { sessionId } = await seedClassWithStudents(1);
    const other = await seedClassWithStudents(1);
    await expect(
      a.asAdmin.enrollment.bulkSetAttendance({
        sessionId,
        entries: [{ enrollmentId: other.enrollmentIds[0], status: "ATTENDED" }],
      }),
    ).rejects.toThrow("enrollments.notFound");
  });
});

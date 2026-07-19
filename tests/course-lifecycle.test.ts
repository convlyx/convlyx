import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { db } from "@/server/db";
import { callerAs, cleanupTenants, createTestTenant, type TestTenant } from "./helpers/tenant";
import type { LicenseCategory } from "@/lib/license-categories";

/**
 * Course lifecycle: course.complete (IN_PROGRESS → COMPLETED, one-shot) and
 * course.currentForStudent (the student's in-progress course, self-or-staff).
 */
describe("course lifecycle", () => {
  let a: TestTenant;

  beforeAll(async () => {
    a = await createTestTenant("COURSELIFE");
  });

  afterAll(async () => {
    await cleanupTenants(a.tenantId);
  });

  /** A fresh IN_PROGRESS course for the seeded student in a given category. */
  async function seedCourse(category: LicenseCategory) {
    const id = randomUUID();
    await db.studentCourse.create({
      data: { id, tenantId: a.tenantId, schoolId: a.schoolId, studentId: a.studentUserId, category },
    });
    return id;
  }

  test("complete moves an in-progress course to COMPLETED with a timestamp", async () => {
    const id = await seedCourse("A");
    const res = await a.asAdmin.course.complete({ id });
    expect(res.id).toBe(id);
    const row = await db.studentCourse.findFirst({ where: { id } });
    expect(row?.status).toBe("COMPLETED");
    expect(row?.completedAt).not.toBeNull();
  });

  test("cannot complete a course that isn't in progress", async () => {
    const id = await seedCourse("A1");
    await a.asAdmin.course.complete({ id });
    await expect(a.asAdmin.course.complete({ id })).rejects.toThrow("courses.notActive");
  });

  test("complete throws NOT_FOUND for an unknown course", async () => {
    await expect(a.asAdmin.course.complete({ id: randomUUID() })).rejects.toThrow("courses.notFound");
  });

  test("currentForStudent returns the in-progress course, then null once completed", async () => {
    const id = await seedCourse("C");
    const before = await a.asAdmin.course.currentForStudent({ studentId: a.studentUserId });
    // The seeded tenant also has a B course in progress; assert our C course is findable.
    const inProgress = await db.studentCourse.findMany({
      where: { tenantId: a.tenantId, studentId: a.studentUserId, status: "IN_PROGRESS" },
      select: { id: true },
    });
    expect(inProgress.map((c) => c.id)).toContain(id);
    expect(before).not.toBeNull();

    await a.asAdmin.course.complete({ id });
    // The B course from the seed may still be in progress; complete it too so
    // "current" is unambiguously null.
    const stillOpen = await db.studentCourse.findMany({
      where: { tenantId: a.tenantId, studentId: a.studentUserId, status: "IN_PROGRESS" },
      select: { id: true },
    });
    for (const c of stillOpen) await a.asAdmin.course.complete({ id: c.id });
    const after = await a.asAdmin.course.currentForStudent({ studentId: a.studentUserId });
    expect(after).toBeNull();
  });

  test("a student cannot read another student's current course", async () => {
    const otherId = randomUUID();
    await db.user.create({ data: { id: otherId, email: `other-${randomUUID().slice(0, 8)}@test.local`, name: "Outro" } });
    await db.membership.create({
      data: { tenantId: a.tenantId, userId: otherId, schoolId: a.schoolId, role: "STUDENT", name: "Outro" },
    });
    const asOther = callerAs(a, otherId);
    await expect(asOther.course.currentForStudent({ studentId: a.studentUserId })).rejects.toThrow(
      "auth.insufficientPermissions",
    );
  });
});

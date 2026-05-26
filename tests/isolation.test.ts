import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { cleanupTenants, createTestTenant, type TestTenant } from "./helpers/tenant";

/**
 * Tenant isolation regression tests. Each test seeds two tenants (A and B)
 * with users, classes, and enrollments, then calls a list-style procedure
 * as tenant A's admin and asserts that no tenant B rows leak through.
 *
 * These are the highest-stakes procedures — anything that returns lists of
 * personal data. Add more as the surface grows.
 */
describe("tenant isolation", () => {
  let a: TestTenant;
  let b: TestTenant;

  beforeAll(async () => {
    [a, b] = await Promise.all([createTestTenant("A"), createTestTenant("B")]);
  });

  afterAll(async () => {
    await cleanupTenants(a.tenantId, b.tenantId);
  });

  test("class.list never returns sessions from another tenant", async () => {
    const result = await a.asAdmin.class.list();
    const ids = result.items.map((c) => c.id);

    // Ensure A's class is visible…
    expect(ids.length).toBeGreaterThan(0);
    // …and nothing from B has snuck in.
    for (const item of result.items) {
      expect(item.school.id).toBe(a.schoolId);
    }
  });

  test("user.list never returns users from another tenant", async () => {
    const result = await a.asAdmin.user.list();
    const ids = result.items.map((u) => u.id);

    // A's three seeded users should be present.
    expect(ids).toEqual(
      expect.arrayContaining([a.adminUserId, a.instructorUserId, a.studentUserId]),
    );
    // None of B's users should leak.
    expect(ids).not.toContain(b.adminUserId);
    expect(ids).not.toContain(b.instructorUserId);
    expect(ids).not.toContain(b.studentUserId);
  });

  test("enrollment.listByStudent (staff path) only returns enrollments from the caller's tenant", async () => {
    // Staff caller, no studentId filter → returns ALL tenant enrollments.
    const result = await a.asAdmin.enrollment.listByStudent();

    expect(result.items.length).toBeGreaterThan(0);
    for (const enrollment of result.items) {
      // Indirect tenant check via the student's id — A only seeded one student.
      expect(enrollment.student.id).toBe(a.studentUserId);
    }
  });

  test("user.studentProfile rejects a student id from another tenant", async () => {
    // Tenant A's admin asks for tenant B's student → must NOT_FOUND, not leak.
    await expect(
      a.asAdmin.user.studentProfile({ id: b.studentUserId }),
    ).rejects.toThrow(/notFound/i);
  });

  test("exam.list never returns exams from another tenant", async () => {
    // Seed one exam per tenant directly (no procedure exists to create an
    // exam without an instructor; we just want the row).
    const examA = randomUUID();
    const examB = randomUUID();
    await db.exam.createMany({
      data: [
        {
          id: examA,
          tenantId: a.tenantId,
          schoolId: a.schoolId,
          courseId: a.courseId,
          type: "THEORY",
          scheduledAt: new Date(Date.now() + 7 * 86_400_000),
          createdById: a.adminUserId,
          updatedById: a.adminUserId,
        },
        {
          id: examB,
          tenantId: b.tenantId,
          schoolId: b.schoolId,
          courseId: b.courseId,
          type: "THEORY",
          scheduledAt: new Date(Date.now() + 7 * 86_400_000),
          createdById: b.adminUserId,
          updatedById: b.adminUserId,
        },
      ],
    });

    try {
      const result = await a.asAdmin.exam.list();
      const ids = result.map((e) => e.id);
      expect(ids).toContain(examA);
      expect(ids).not.toContain(examB);
    } finally {
      await db.exam.deleteMany({ where: { id: { in: [examA, examB] } } });
    }
  });

  test("course.listByStudent for another tenant's student returns no courses", async () => {
    // Staff path: A's admin asks for tenant B's student's courses. The
    // procedure scopes the query by ctx.tenantId, so B's student in A's
    // tenant context resolves to no rows — leak-safe by design.
    const result = await a.asAdmin.course.listByStudent({ studentId: b.studentUserId });
    expect(result).toEqual([]);
  });

  test("user.exportData rejects another tenant's user id", async () => {
    await expect(
      a.asAdmin.user.exportData({ id: b.studentUserId }),
    ).rejects.toThrow(/notFound/i);
  });

  test("user.exportData returns the expected sections", async () => {
    const dump = await a.asAdmin.user.exportData({ id: a.studentUserId });
    expect(dump.format).toBe("convlyx.gdpr.v1");
    expect(dump.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(dump.profile.id).toBe(a.studentUserId);
    // The helper seeded a course and an enrollment for the student.
    expect(dump.studentCourses.length).toBeGreaterThan(0);
    expect(dump.enrollments.length).toBeGreaterThan(0);
    expect(Array.isArray(dump.instructedSessions)).toBe(true);
    expect(Array.isArray(dump.notifications)).toBe(true);
    expect(Array.isArray(dump.pushSubscriptions)).toBe(true);
  });

  test("notification.list never returns another user's notifications", async () => {
    // Seed a notification for B's admin directly, then make sure A's admin
    // (who's calling) doesn't see it.
    const notifId = randomUUID();
    await db.notification.create({
      data: {
        id: notifId,
        tenantId: b.tenantId,
        schoolId: b.schoolId,
        userId: b.adminUserId,
        type: "test.leak",
        title: "notifications.classWasCancelled",
        message: "notifications.classCancelled",
      },
    });

    try {
      const result = await a.asAdmin.notification.list();
      const ids = result.map((n) => n.id);
      expect(ids).not.toContain(notifId);
    } finally {
      await db.notification.delete({ where: { id: notifId } });
    }
  });
});

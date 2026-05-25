import { afterAll, beforeAll, describe, expect, test } from "vitest";
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
});

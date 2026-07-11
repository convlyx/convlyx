import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/server/db";
import { createTestTenant, cleanupTenants, type TestTenant } from "./helpers/tenant";

let A: TestTenant;

beforeAll(async () => {
  A = await createTestTenant("user-list-mem");
});
afterAll(async () => {
  if (A) await cleanupTenants(A.tenantId);
});

describe("user.list / countByRole are Membership-driven", () => {
  it("lists the seeded roster with membership roles + current category", async () => {
    const { items, total } = await A.asAdmin.user.list();
    expect(total).toBe(3);
    const byId = new Map(items.map((i) => [i.id, i]));
    expect(byId.get(A.adminUserId)?.role).toBe("ADMIN");
    expect(byId.get(A.instructorUserId)?.role).toBe("INSTRUCTOR");
    // The seeded student has an in-progress category-B course.
    expect(byId.get(A.studentUserId)?.role).toBe("STUDENT");
    expect(byId.get(A.studentUserId)?.currentCategory).toBe("B");
  });

  it("filters by the MEMBERSHIP role, not the User.role column", async () => {
    // Flip only the Membership role → INSTRUCTOR, leaving User.role = STUDENT.
    // If the query still read User.role, this user would appear under STUDENT.
    await db.membership.updateMany({
      where: { tenantId: A.tenantId, userId: A.studentUserId },
      data: { role: "INSTRUCTOR" },
    });

    const asInstructor = await A.asAdmin.user.list({ role: "INSTRUCTOR" });
    expect(asInstructor.items.map((i) => i.id)).toContain(A.studentUserId);
    // And the reported role reflects the membership.
    expect(asInstructor.items.find((i) => i.id === A.studentUserId)?.role).toBe("INSTRUCTOR");

    const asStudent = await A.asAdmin.user.list({ role: "STUDENT" });
    expect(asStudent.items.map((i) => i.id)).not.toContain(A.studentUserId);

    // countByRole agrees: 2 instructors now (seeded instructor + flipped student),
    // 0 students.
    const instructorCount = await A.asAdmin.user.countByRole({ role: "INSTRUCTOR" });
    expect(instructorCount.count).toBe(2);
    const studentCount = await A.asAdmin.user.countByRole({ role: "STUDENT" });
    expect(studentCount.count).toBe(0);

    // Restore for any later assertions / cleanup symmetry.
    await db.membership.updateMany({
      where: { tenantId: A.tenantId, userId: A.studentUserId },
      data: { role: "STUDENT" },
    });
  });

  it("search matches the joined User name/email", async () => {
    const { items } = await A.asAdmin.user.list({ search: "Instrutor" });
    expect(items.map((i) => i.id)).toContain(A.instructorUserId);
    expect(items.map((i) => i.id)).not.toContain(A.studentUserId);
  });
});

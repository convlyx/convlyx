import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { db } from "@/server/db";
import { callerAs, cleanupTenants, createTestTenant, type TestTenant } from "./helpers/tenant";

/**
 * class.instructorUnavailable — an instructor flags they can't teach a
 * scheduled class of their own. The class is cancelled, its enrolments are
 * removed, and admins/secretaries are notified. Only the class's own
 * instructor may do this, and only while it's still SCHEDULED.
 */
describe("class.instructorUnavailable", () => {
  let a: TestTenant;

  beforeAll(async () => {
    a = await createTestTenant("INSTUNAVAIL");
  });

  afterAll(async () => {
    await cleanupTenants(a.tenantId);
  });

  async function seedClass(opts?: { instructorId?: string; status?: "SCHEDULED" | "CANCELLED"; withStudent?: boolean }) {
    const id = randomUUID();
    const startsAt = new Date(Date.now() + 72 * 3600_000);
    await db.classSession.create({
      data: {
        id,
        tenantId: a.tenantId,
        schoolId: a.schoolId,
        classType: "THEORY",
        title: "Aula",
        startsAt,
        endsAt: new Date(startsAt.getTime() + 3600_000),
        capacity: 10,
        status: opts?.status ?? "SCHEDULED",
        instructorId: opts?.instructorId ?? a.instructorUserId,
        createdById: a.adminUserId,
        updatedById: a.adminUserId,
      },
    });
    if (opts?.withStudent) {
      await db.enrollment.create({
        data: { tenantId: a.tenantId, schoolId: a.schoolId, sessionId: id, studentId: a.studentUserId },
      });
    }
    return id;
  }

  test("cancels the class, removes enrolments, and notifies admins", async () => {
    const id = await seedClass({ withStudent: true });
    const asInstructor = callerAs(a, a.instructorUserId);
    await asInstructor.class.instructorUnavailable({ id });

    const session = await db.classSession.findFirst({ where: { id }, select: { status: true } });
    expect(session?.status).toBe("CANCELLED");

    const remaining = await db.enrollment.count({ where: { sessionId: id } });
    expect(remaining).toBe(0);

    const adminNotif = await db.notification.findFirst({
      where: { tenantId: a.tenantId, userId: a.adminUserId, type: "class.instructorUnavailable" },
    });
    expect(adminNotif).not.toBeNull();
  });

  test("rejects a class the caller doesn't teach", async () => {
    // Class owned by a second instructor.
    const otherInstructor = randomUUID();
    await db.user.create({ data: { id: otherInstructor, email: `inst-${randomUUID().slice(0, 8)}@test.local`, name: "Instrutor 2" } });
    await db.membership.create({
      data: { tenantId: a.tenantId, userId: otherInstructor, schoolId: a.schoolId, role: "INSTRUCTOR", qualifiedCategories: ["B"], name: "Instrutor 2" },
    });
    const id = await seedClass({ instructorId: otherInstructor });

    const asInstructor = callerAs(a, a.instructorUserId);
    await expect(asInstructor.class.instructorUnavailable({ id })).rejects.toThrow("classes.notFound");
  });

  test("rejects a class that is not SCHEDULED", async () => {
    const id = await seedClass({ status: "CANCELLED" });
    const asInstructor = callerAs(a, a.instructorUserId);
    await expect(asInstructor.class.instructorUnavailable({ id })).rejects.toThrow("classes.notFound");
  });
});

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { db } from "@/server/db";
import { cleanupTenants, createTestTenant, type TestTenant } from "./helpers/tenant";

/**
 * class.update — editing a scheduled class. Re-runs instructor + enrolled-
 * student schedule-conflict checks at the new time, enforces category/status
 * rules, and notifies affected parties on instructor or schedule changes.
 */
describe("class.update", () => {
  let a: TestTenant;
  let secondInstructorId: string;

  beforeAll(async () => {
    a = await createTestTenant("CLASSUPD");
    secondInstructorId = randomUUID();
    await db.user.create({ data: { id: secondInstructorId, email: `inst2-${randomUUID().slice(0, 8)}@test.local`, name: "Instrutor 2" } });
    await db.membership.create({
      data: { tenantId: a.tenantId, userId: secondInstructorId, schoolId: a.schoolId, role: "INSTRUCTOR", qualifiedCategories: ["B"], name: "Instrutor 2" },
    });
  });

  afterAll(async () => {
    await cleanupTenants(a.tenantId);
  });

  /** A standalone scheduled class (no enrollments), `hoursFromNow` out. */
  async function seedClass(opts?: { classType?: "THEORY" | "PRACTICAL"; hoursFromNow?: number; instructorId?: string }) {
    const id = randomUUID();
    const startsAt = new Date(Date.now() + (opts?.hoursFromNow ?? 72) * 3600_000);
    const endsAt = new Date(startsAt.getTime() + 3600_000);
    await db.classSession.create({
      data: {
        id,
        tenantId: a.tenantId,
        schoolId: a.schoolId,
        classType: opts?.classType ?? "THEORY",
        category: opts?.classType === "PRACTICAL" ? "B" : null,
        title: "Aula",
        startsAt,
        endsAt,
        capacity: 10,
        instructorId: opts?.instructorId ?? a.instructorUserId,
        createdById: a.adminUserId,
        updatedById: a.adminUserId,
      },
    });
    return { id, startsAt, endsAt };
  }

  const iso = (d: Date) => d.toISOString();

  test("updates a class to a new, conflict-free time", async () => {
    const c = await seedClass();
    const newStart = new Date(c.startsAt.getTime() + 3 * 3600_000);
    const res = await a.asAdmin.class.update({
      id: c.id,
      instructorId: a.instructorUserId,
      title: "Aula (nova)",
      capacity: 10,
      startsAt: iso(newStart),
      endsAt: iso(new Date(newStart.getTime() + 3600_000)),
    });
    expect(res.id).toBe(c.id);
    const row = await db.classSession.findFirst({ where: { id: c.id } });
    expect(row?.title).toBe("Aula (nova)");
    expect(row?.startsAt.toISOString()).toBe(newStart.toISOString());
  });

  test("rejects a time that collides with the instructor's other class", async () => {
    const busy = await seedClass({ hoursFromNow: 100 }); // instructor a.instructorUserId is busy here
    const target = await seedClass({ hoursFromNow: 200, instructorId: secondInstructorId });
    // Move `target` onto `busy`'s slot while assigning a.instructorUserId → conflict.
    await expect(
      a.asAdmin.class.update({
        id: target.id,
        instructorId: a.instructorUserId,
        title: "Colisão",
        capacity: 10,
        startsAt: iso(busy.startsAt),
        endsAt: iso(busy.endsAt),
      }),
    ).rejects.toThrow("classes.scheduleConflict");
  });

  test("rejects a move that would double-book an enrolled student", async () => {
    // Student is enrolled in the seeded class (tomorrow). Create a second class,
    // enrol the same student, then try to move it onto the seeded class's slot.
    const other = await seedClass({ hoursFromNow: 300, instructorId: secondInstructorId });
    await db.enrollment.create({
      data: { tenantId: a.tenantId, schoolId: a.schoolId, sessionId: other.id, studentId: a.studentUserId },
    });
    const seeded = await db.classSession.findFirst({ where: { id: a.sessionId }, select: { startsAt: true, endsAt: true } });
    await expect(
      a.asAdmin.class.update({
        id: other.id,
        instructorId: secondInstructorId,
        title: "Choca com aluno",
        capacity: 10,
        startsAt: iso(seeded!.startsAt),
        endsAt: iso(seeded!.endsAt),
      }),
    ).rejects.toThrow("classes.studentScheduleConflict");
  });

  test("rejects editing a cancelled class", async () => {
    const c = await seedClass();
    await db.classSession.update({ where: { id: c.id }, data: { status: "CANCELLED" } });
    await expect(
      a.asAdmin.class.update({
        id: c.id,
        instructorId: a.instructorUserId,
        title: "X",
        capacity: 10,
        startsAt: iso(c.startsAt),
        endsAt: iso(c.endsAt),
      }),
    ).rejects.toThrow("classes.cannotEditFinished");
  });

  test("requires a category on a practical class", async () => {
    const c = await seedClass({ classType: "PRACTICAL" });
    await expect(
      a.asAdmin.class.update({
        id: c.id,
        instructorId: a.instructorUserId,
        title: "Sem categoria",
        capacity: 10,
        startsAt: iso(c.startsAt),
        endsAt: iso(c.endsAt),
        // category omitted
      }),
    ).rejects.toThrow("classes.categoryRequired");
  });

  test("reassigning the instructor notifies old + new instructor", async () => {
    const c = await seedClass({ hoursFromNow: 400 });
    await a.asAdmin.class.update({
      id: c.id,
      instructorId: secondInstructorId,
      title: "Reatribuída",
      capacity: 10,
      startsAt: iso(c.startsAt),
      endsAt: iso(c.endsAt),
    });
    const notifs = await db.notification.findMany({
      where: { tenantId: a.tenantId, type: "class.instructorChanged", userId: { in: [a.instructorUserId, secondInstructorId] } },
    });
    const notifiedUsers = new Set(notifs.map((n) => n.userId));
    expect(notifiedUsers.has(a.instructorUserId)).toBe(true);
    expect(notifiedUsers.has(secondInstructorId)).toBe(true);
  });
});

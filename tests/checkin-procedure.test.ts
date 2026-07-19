import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { db } from "@/server/db";
import { callerAs, cleanupTenants, createTestTenant, type TestTenant } from "./helpers/tenant";
import { currentToken } from "@/server/lib/checkin-token";

/**
 * Student QR self-check-in (enrollment.checkIn). The token crypto is unit-
 * tested separately (checkin-token.test.ts); this covers the *procedure*:
 * theory-only, same-school, open window, token validity, idempotent ATTENDED,
 * and walk-in auto-enrolment within capacity.
 */
describe("enrollment.checkIn", () => {
  let a: TestTenant;
  const secret = "a".repeat(64); // any hex-ish secret; token is derived from it
  let studentCaller: ReturnType<typeof callerAs>;

  beforeAll(async () => {
    a = await createTestTenant("CHECKIN");
    studentCaller = callerAs(a, a.studentUserId);
  });

  afterAll(async () => {
    await cleanupTenants(a.tenantId);
  });

  /** A theory session with the check-in window open (secret set). */
  async function seedOpenTheory(opts?: { capacity?: number; schoolId?: string }) {
    const id = randomUUID();
    const now = new Date();
    await db.classSession.create({
      data: {
        id,
        tenantId: a.tenantId,
        schoolId: opts?.schoolId ?? a.schoolId,
        classType: "THEORY",
        title: "Aula teórica",
        startsAt: new Date(now.getTime() - 600_000),
        endsAt: new Date(now.getTime() + 600_000),
        capacity: opts?.capacity ?? 20,
        instructorId: a.instructorUserId,
        createdById: a.adminUserId,
        updatedById: a.adminUserId,
        checkInOpenedAt: now,
        checkInSecret: secret,
      },
    });
    return id;
  }

  function validToken(sessionId: string) {
    return currentToken(secret, sessionId, Date.now());
  }

  test("rejects a practical class", async () => {
    const id = randomUUID();
    await db.classSession.create({
      data: {
        id,
        tenantId: a.tenantId,
        schoolId: a.schoolId,
        classType: "PRACTICAL",
        category: "B",
        title: "Prática",
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 3600_000),
        capacity: 2,
        instructorId: a.instructorUserId,
        createdById: a.adminUserId,
        updatedById: a.adminUserId,
        checkInOpenedAt: new Date(),
        checkInSecret: secret,
      },
    });
    await expect(studentCaller.enrollment.checkIn({ sessionId: id, token: validToken(id) })).rejects.toThrow(
      "checkin.notTheory",
    );
  });

  test("rejects a session in a different school", async () => {
    const otherSchoolId = randomUUID();
    await db.school.create({
      data: { id: otherSchoolId, tenantId: a.tenantId, subdomain: `other-${randomUUID().slice(0, 8)}`, name: "Outra" },
    });
    const id = await seedOpenTheory({ schoolId: otherSchoolId });
    await expect(studentCaller.enrollment.checkIn({ sessionId: id, token: validToken(id) })).rejects.toThrow(
      "checkin.differentSchool",
    );
  });

  test("rejects when the check-in window is closed", async () => {
    const id = randomUUID();
    await db.classSession.create({
      data: {
        id,
        tenantId: a.tenantId,
        schoolId: a.schoolId,
        classType: "THEORY",
        title: "Fechada",
        startsAt: new Date(Date.now() - 600_000),
        endsAt: new Date(Date.now() + 600_000),
        capacity: 20,
        instructorId: a.instructorUserId,
        createdById: a.adminUserId,
        updatedById: a.adminUserId,
        // no checkInOpenedAt / checkInSecret → window closed
      },
    });
    await expect(studentCaller.enrollment.checkIn({ sessionId: id, token: "deadbeefdeadbeef" })).rejects.toThrow(
      "checkin.windowClosed",
    );
  });

  test("rejects a forged / expired token", async () => {
    const id = await seedOpenTheory();
    await expect(studentCaller.enrollment.checkIn({ sessionId: id, token: "0".repeat(16) })).rejects.toThrow(
      "checkin.tokenExpired",
    );
  });

  test("marks an enrolled-but-not-attended student ATTENDED", async () => {
    const id = await seedOpenTheory();
    await db.enrollment.create({
      data: { tenantId: a.tenantId, schoolId: a.schoolId, sessionId: id, studentId: a.studentUserId },
    });
    const res = await studentCaller.enrollment.checkIn({ sessionId: id, token: validToken(id) });
    expect(res).toMatchObject({ success: true, alreadyMarked: false });
    const row = await db.enrollment.findFirst({ where: { sessionId: id, studentId: a.studentUserId } });
    expect(row?.status).toBe("ATTENDED");
    expect(row?.checkedInAt).not.toBeNull();
  });

  test("is idempotent — a second check-in reports alreadyMarked", async () => {
    const id = await seedOpenTheory();
    await db.enrollment.create({
      data: { tenantId: a.tenantId, schoolId: a.schoolId, sessionId: id, studentId: a.studentUserId, status: "ATTENDED" },
    });
    const res = await studentCaller.enrollment.checkIn({ sessionId: id, token: validToken(id) });
    expect(res).toMatchObject({ success: true, alreadyMarked: true });
  });

  test("walk-in with room auto-enrols as ATTENDED", async () => {
    const id = await seedOpenTheory({ capacity: 5 });
    const res = await studentCaller.enrollment.checkIn({ sessionId: id, token: validToken(id) });
    expect(res).toMatchObject({ success: true, alreadyMarked: false });
    const row = await db.enrollment.findFirst({ where: { sessionId: id, studentId: a.studentUserId } });
    expect(row?.status).toBe("ATTENDED");
  });

  test("walk-in is rejected when the class is full", async () => {
    const id = await seedOpenTheory({ capacity: 1 });
    // Fill the seat with someone else so the walk-in student has no room.
    await db.enrollment.create({
      data: { tenantId: a.tenantId, schoolId: a.schoolId, sessionId: id, studentId: a.instructorUserId },
    });
    await expect(studentCaller.enrollment.checkIn({ sessionId: id, token: validToken(id) })).rejects.toThrow(
      "enrollments.classFull",
    );
  });
});

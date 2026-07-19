import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { db } from "@/server/db";
import { callerAs, cleanupTenants, createTestTenant, type TestTenant } from "./helpers/tenant";
import type { UserRole } from "@/generated/prisma/enums";

/**
 * Role-authorization matrix — the executable spec for "who can do what", and a
 * guard against *false affordances*: a surface must never let a role trigger an
 * action the server would reject. This asserts the enforcement boundary — for
 * every role-gated mutation, every role OUTSIDE its allowlist is rejected with
 * FORBIDDEN ("auth.insufficientPermissions") before the handler runs.
 *
 * Inputs are deliberately VALID (real seeded ids, correct shapes) so a rejection
 * can only come from the role gate, not from input validation. Disallowed roles
 * are stopped in middleware before the resolver, so nothing is mutated — the
 * seeded fixtures stay intact across every case regardless of order.
 *
 * Only `roleProtectedProcedure` mutations live here (clean role gate). The
 * `protectedProcedure` actions with nuanced inline auth (enroll/cancel with
 * ownership + notice window, self-enrol eligibility) are covered by their own
 * dedicated suites.
 */

const ROLES: UserRole[] = ["ADMIN", "SECRETARY", "INSTRUCTOR", "STUDENT"];

// Valid ISO instants for the datetime-typed inputs (value is irrelevant — the
// disallowed callers never reach the handler).
const startsAt = new Date(Date.now() + 5 * 86_400_000).toISOString();
const endsAt = new Date(Date.now() + 5 * 86_400_000 + 3_600_000).toISOString();

let a: TestTenant;
// Populated in beforeAll; the case `run` closures read these at execution time.
const ids = {
  schoolId: "",
  sessionId: "",
  enrollmentId: "",
  courseId: "",
  studentId: "",
  instructorId: "",
  examId: "",
};
const callers = {} as Record<UserRole, ReturnType<typeof callerAs>>;

beforeAll(async () => {
  a = await createTestTenant("ROLEMATRIX");

  // The seed has no SECRETARY — add one so all four roles are exercised.
  const secretaryId = randomUUID();
  await db.user.create({
    data: { id: secretaryId, email: `sec-${randomUUID().slice(0, 8)}@test.local`, name: "Secretária" },
  });
  await db.membership.create({
    data: { tenantId: a.tenantId, userId: secretaryId, schoolId: a.schoolId, role: "SECRETARY", name: "Secretária" },
  });

  // A SCHEDULED exam for the exam.* cases.
  const examId = randomUUID();
  await db.exam.create({
    data: {
      id: examId,
      tenantId: a.tenantId,
      schoolId: a.schoolId,
      courseId: a.courseId,
      type: "THEORY",
      result: "SCHEDULED",
      scheduledAt: new Date(Date.now() + 5 * 86_400_000),
      createdById: a.adminUserId,
      updatedById: a.adminUserId,
    },
  });

  Object.assign(ids, {
    schoolId: a.schoolId,
    sessionId: a.sessionId,
    enrollmentId: a.enrollmentId,
    courseId: a.courseId,
    studentId: a.studentUserId,
    instructorId: a.instructorUserId,
    examId,
  });
  callers.ADMIN = a.asAdmin;
  callers.SECRETARY = callerAs(a, secretaryId);
  callers.INSTRUCTOR = callerAs(a, a.instructorUserId);
  callers.STUDENT = callerAs(a, a.studentUserId);
});

afterAll(async () => {
  if (a) await cleanupTenants(a.tenantId);
});

type Caller = ReturnType<typeof callerAs>;

const cases: { name: string; allowed: UserRole[]; run: (c: Caller) => Promise<unknown> }[] = [
  // ── classes ──────────────────────────────────────────────────────────────
  { name: "class.create", allowed: ["ADMIN", "SECRETARY", "INSTRUCTOR"], run: (c) =>
      c.class.create({ schoolId: ids.schoolId, classType: "THEORY", instructorId: ids.instructorId, title: "X", capacity: 5, startsAt, endsAt }) },
  { name: "class.update", allowed: ["ADMIN", "SECRETARY"], run: (c) =>
      c.class.update({ id: ids.sessionId, instructorId: ids.instructorId, title: "X", capacity: 5, startsAt, endsAt }) },
  { name: "class.cancel", allowed: ["ADMIN", "SECRETARY"], run: (c) => c.class.cancel({ id: ids.sessionId }) },
  { name: "class.instructorUnavailable", allowed: ["INSTRUCTOR"], run: (c) => c.class.instructorUnavailable({ id: ids.sessionId }) },

  // ── enrolments / attendance ──────────────────────────────────────────────
  { name: "enrollment.markAttendance", allowed: ["ADMIN", "SECRETARY", "INSTRUCTOR"], run: (c) =>
      c.enrollment.markAttendance({ enrollmentId: ids.enrollmentId, status: "ATTENDED" }) },
  { name: "enrollment.addNote", allowed: ["INSTRUCTOR"], run: (c) =>
      c.enrollment.addNote({ enrollmentId: ids.enrollmentId, notes: "x" }) },
  { name: "enrollment.bulkMarkAttendance", allowed: ["ADMIN", "SECRETARY", "INSTRUCTOR"], run: (c) =>
      c.enrollment.bulkMarkAttendance({ sessionId: ids.sessionId, status: "ATTENDED" }) },
  { name: "enrollment.checkIn", allowed: ["STUDENT"], run: (c) =>
      c.enrollment.checkIn({ sessionId: ids.sessionId, token: "0000000000000000" }) },

  // ── exams ────────────────────────────────────────────────────────────────
  { name: "exam.schedule", allowed: ["ADMIN", "SECRETARY"], run: (c) =>
      c.exam.schedule({ courseId: ids.courseId, type: "THEORY", scheduledAt: startsAt }) },
  { name: "exam.recordResult", allowed: ["ADMIN", "SECRETARY", "INSTRUCTOR"], run: (c) =>
      c.exam.recordResult({ id: ids.examId, result: "PASSED" }) },
  { name: "exam.cancel", allowed: ["ADMIN", "SECRETARY"], run: (c) => c.exam.cancel({ id: ids.examId }) },

  // ── courses ──────────────────────────────────────────────────────────────
  { name: "course.start", allowed: ["ADMIN", "SECRETARY"], run: (c) => c.course.start({ studentId: ids.studentId, category: "C" }) },
  { name: "course.complete", allowed: ["ADMIN", "SECRETARY"], run: (c) => c.course.complete({ id: ids.courseId }) },
  { name: "course.abandon", allowed: ["ADMIN", "SECRETARY"], run: (c) => c.course.abandon({ id: ids.courseId }) },

  // ── users ────────────────────────────────────────────────────────────────
  { name: "user.create", allowed: ["ADMIN", "SECRETARY"], run: (c) =>
      c.user.create({ name: "X", email: `m-${randomUUID().slice(0, 8)}@test.local`, role: "INSTRUCTOR", schoolId: ids.schoolId }) },
  { name: "user.update", allowed: ["ADMIN", "SECRETARY"], run: (c) =>
      c.user.update({ id: ids.studentId, name: "X", role: "STUDENT", schoolId: ids.schoolId }) },
  { name: "user.deactivate", allowed: ["ADMIN", "SECRETARY"], run: (c) => c.user.deactivate({ id: ids.studentId }) },
  { name: "user.activate", allowed: ["ADMIN", "SECRETARY"], run: (c) => c.user.activate({ id: ids.studentId }) },
  { name: "user.resendInvite", allowed: ["ADMIN", "SECRETARY"], run: (c) => c.user.resendInvite({ id: ids.studentId }) },
  { name: "user.delete", allowed: ["ADMIN"], run: (c) => c.user.delete({ id: ids.studentId }) },
  { name: "user.anonymize", allowed: ["ADMIN"], run: (c) => c.user.anonymize({ id: ids.studentId }) },

  // ── schools / tenant ─────────────────────────────────────────────────────
  { name: "school.create", allowed: ["ADMIN"], run: (c) =>
      c.school.create({ name: "X", subdomain: `sub-${randomUUID().slice(0, 8)}`, timeZone: "Europe/Lisbon" }) },
  { name: "school.update", allowed: ["ADMIN", "SECRETARY"], run: (c) => c.school.update({ id: ids.schoolId, name: "X" }) },
  { name: "school.updateTenant", allowed: ["ADMIN"], run: (c) => c.school.updateTenant({ name: "X" }) },
];

describe("role authorization matrix (false-affordance guard)", () => {
  for (const { name, allowed, run } of cases) {
    const disallowed = ROLES.filter((r) => !allowed.includes(r));
    describe(`${name} — allowed: ${allowed.join("/")}`, () => {
      for (const role of disallowed) {
        test(`rejects ${role}`, async () => {
          await expect(run(callers[role])).rejects.toThrow("auth.insufficientPermissions");
        });
      }
    });
  }
});

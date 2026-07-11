import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { createCallerFactory } from "@/server/trpc";
import { appRouter } from "@/server/routers/_app";

const createCaller = createCallerFactory(appRouter);

export type TestTenant = {
  tenantId: string;
  schoolId: string;
  adminUserId: string;
  instructorUserId: string;
  studentUserId: string;
  sessionId: string;
  enrollmentId: string;
  courseId: string;
  /** tRPC caller authenticated as the ADMIN of this tenant. */
  asAdmin: ReturnType<typeof createCaller>;
};

/**
 * Spin up a fresh tenant + school + one user per role, plus a class taught
 * by the instructor and an enrollment for the student. IDs are random UUIDs
 * so parallel tests don't collide. Use `cleanupTenants` in afterAll to wipe.
 */
export async function createTestTenant(label: string): Promise<TestTenant> {
  const suffix = randomUUID().slice(0, 8);
  const tenantId = randomUUID();
  const schoolId = randomUUID();
  const adminUserId = randomUUID();
  const instructorUserId = randomUUID();
  const studentUserId = randomUUID();

  await db.$transaction([
    db.tenant.create({ data: { id: tenantId, name: `test-${label}-${suffix}` } }),
    db.school.create({
      data: {
        id: schoolId,
        tenantId,
        subdomain: `test-${label}-${suffix}`,
        name: `Escola ${label}`,
      },
    }),
    db.user.create({
      data: {
        id: adminUserId,
        tenantId,
        schoolId,
        email: `admin-${suffix}@test.local`,
        name: `Admin ${label}`,
        role: "ADMIN",
      },
    }),
    db.user.create({
      data: {
        id: instructorUserId,
        tenantId,
        schoolId,
        email: `instructor-${suffix}@test.local`,
        name: `Instrutor ${label}`,
        role: "INSTRUCTOR",
        qualifiedCategories: ["B"],
      },
    }),
    db.user.create({
      data: {
        id: studentUserId,
        tenantId,
        schoolId,
        email: `student-${suffix}@test.local`,
        name: `Aluno ${label}`,
        role: "STUDENT",
      },
    }),
    db.membership.createMany({
      data: [
        { tenantId, userId: adminUserId, schoolId, role: "ADMIN" },
        { tenantId, userId: instructorUserId, schoolId, role: "INSTRUCTOR", qualifiedCategories: ["B"] },
        { tenantId, userId: studentUserId, schoolId, role: "STUDENT" },
      ],
    }),
  ]);

  // Add a future class taught by the instructor, an enrollment, and an
  // in-progress course for the student — covers the surface most cross-
  // tenant tests need to exercise (sessionId / enrollmentId / courseId).
  const sessionId = randomUUID();
  const enrollmentId = randomUUID();
  const courseId = randomUUID();
  const startsAt = new Date(Date.now() + 86_400_000); // tomorrow
  const endsAt = new Date(startsAt.getTime() + 3_600_000);
  await db.classSession.create({
    data: {
      id: sessionId,
      tenantId,
      schoolId,
      classType: "THEORY",
      title: `Aula ${label}`,
      startsAt,
      endsAt,
      capacity: 20,
      instructorId: instructorUserId,
      createdById: adminUserId,
      updatedById: adminUserId,
    },
  });
  await db.enrollment.create({
    data: {
      id: enrollmentId,
      tenantId,
      schoolId,
      sessionId,
      studentId: studentUserId,
    },
  });
  await db.studentCourse.create({
    data: {
      id: courseId,
      tenantId,
      schoolId,
      studentId: studentUserId,
      category: "B",
    },
  });

  const asAdmin = createCaller({
    db,
    tenantId,
    ip: null,
    user: {
      id: adminUserId,
      role: "ADMIN",
      tenantId,
      schoolId,
    },
  });

  return {
    tenantId,
    schoolId,
    adminUserId,
    instructorUserId,
    studentUserId,
    sessionId,
    enrollmentId,
    courseId,
    asAdmin,
  };
}

/** Delete tenants + all dependent rows, in FK-safe order. */
export async function cleanupTenants(...tenantIds: string[]) {
  if (tenantIds.length === 0) return;
  await db.$transaction([
    db.exam.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    db.enrollment.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    db.classSession.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    db.studentCourse.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    db.notification.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    db.pushSubscription.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    db.consentRecord.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    db.membership.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    db.user.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    db.school.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    db.tenant.deleteMany({ where: { id: { in: tenantIds } } }),
  ]);
}

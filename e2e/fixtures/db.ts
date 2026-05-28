import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import "dotenv/config";

/**
 * Test-data helpers for the E2E suite. Uses raw `pg` rather than the
 * Prisma client because Prisma 7's generated client is ESM-only and
 * imports `import.meta.url`, which Playwright's CJS test loader can't
 * pull in. Raw SQL also avoids any test↔Prisma-client coupling.
 *
 * All inserts assume the seeded demo tenant (`admin@demo.pt`, `aluno@demo.pt`,
 * `instrutor@demo.pt`). Random UUIDs keep parallel runs collision-safe.
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let _seededIds: {
  tenantId: string;
  schoolId: string;
  adminId: string;
  instructorId: string;
  studentId: string;
} | null = null;

async function loadSeededIds() {
  const result = await pool.query<{
    email: string;
    id: string;
    tenant_id: string;
    school_id: string;
  }>(
    `SELECT email, id, tenant_id, school_id
       FROM public.users
      WHERE email IN ('admin@demo.pt', 'instrutor@demo.pt', 'aluno@demo.pt')`,
  );

  const admin = result.rows.find((r) => r.email === "admin@demo.pt");
  const instructor = result.rows.find((r) => r.email === "instrutor@demo.pt");
  const student = result.rows.find((r) => r.email === "aluno@demo.pt");

  if (!admin || !instructor || !student) {
    throw new Error(
      "E2E suite expects seeded users (admin@demo.pt, instrutor@demo.pt, aluno@demo.pt). Run `pnpm db:seed` first.",
    );
  }

  return {
    tenantId: admin.tenant_id,
    schoolId: admin.school_id,
    adminId: admin.id,
    instructorId: instructor.id,
    studentId: student.id,
  };
}

export async function getSeededIds() {
  if (!_seededIds) _seededIds = await loadSeededIds();
  return _seededIds;
}

type CreateClassOptions = {
  startsAt?: Date;
  endsAt?: Date;
  status?: "SCHEDULED" | "IN_PROGRESS";
  classType?: "THEORY" | "PRACTICAL";
};

export async function createTestClass(options: CreateClassOptions = {}) {
  const ids = await getSeededIds();
  const now = new Date();
  const startsAt = options.startsAt ?? new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const endsAt = options.endsAt ?? new Date(startsAt.getTime() + 60 * 60 * 1000);
  const classId = randomUUID();
  const status = options.status ?? "SCHEDULED";
  const classType = options.classType ?? "THEORY";

  await pool.query(
    `INSERT INTO public.class_sessions (
       id, tenant_id, school_id, instructor_id, title, class_type,
       starts_at, ends_at, capacity, status, created_by, updated_by,
       created_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6::"ClassType", $7, $8, 10, $9::"ClassStatus", $10, $10, now(), now())`,
    [
      classId,
      ids.tenantId,
      ids.schoolId,
      ids.instructorId,
      `E2E test class ${classId.slice(0, 8)}`,
      classType,
      startsAt,
      endsAt,
      status,
      ids.adminId,
    ],
  );
  return classId;
}

export async function enrolSeededStudent(classId: string) {
  const ids = await getSeededIds();
  const enrollmentId = randomUUID();
  await pool.query(
    `INSERT INTO public.enrollments (
       id, tenant_id, school_id, session_id, student_id, status,
       enrolled_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, 'ENROLLED'::"EnrollmentStatus", now(), now())`,
    [enrollmentId, ids.tenantId, ids.schoolId, classId, ids.studentId],
  );
  return enrollmentId;
}

export async function deleteTestClass(classId: string) {
  await pool.query(`DELETE FROM public.enrollments WHERE session_id = $1`, [classId]);
  await pool.query(`DELETE FROM public.class_sessions WHERE id = $1`, [classId]);
}

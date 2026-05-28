import type { DbClient } from "./tenant-scope";
import type { LicenseCategory } from "@/lib/license-categories";

/**
 * Resolve what classes a student is allowed to see/enroll in based on their
 * active driving-license course and exam history.
 *
 * Universal domain rules (not configurable):
 *   - A student must have an in-progress `StudentCourse` to access classes.
 *     Without one, no classes are visible.
 *   - Practical classes are scoped to the student's active category.
 *   - Theory classes are visible only until the student passes the theory
 *     exam for their active category — afterwards they're irrelevant.
 */
export async function getStudentClassAccess(
  db: DbClient,
  tenantId: string,
  studentId: string,
): Promise<{
  activeCategory: LicenseCategory | null;
  canSeeTheory: boolean;
}> {
  const activeCourse = await db.studentCourse.findFirst({
    where: { studentId, tenantId, status: "IN_PROGRESS" },
    select: { id: true, category: true },
  });

  if (!activeCourse) {
    return { activeCategory: null, canSeeTheory: false };
  }

  const passedTheory = await db.exam.findFirst({
    where: {
      tenantId,
      type: "THEORY",
      result: "PASSED",
      course: { studentId, category: activeCourse.category },
    },
    select: { id: true },
  });

  return {
    activeCategory: activeCourse.category,
    canSeeTheory: !passedTheory,
  };
}

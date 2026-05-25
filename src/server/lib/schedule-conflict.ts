import type { PrismaClient } from "@/generated/prisma/client";

// Exams have no end time in the DB — by UI convention they occupy a 60-min
// slot starting at `scheduledAt`. The conflict check treats them that way.
const EXAM_DURATION_MS = 60 * 60 * 1000;

type Window = { startsAt: Date; endsAt: Date };

/**
 * True if the instructor has any non-cancelled class OR any scheduled exam
 * overlapping one of the given windows.
 *
 * - Cancelled classes are ignored.
 * - Exam `result` must be `SCHEDULED` to count (a PASSED/FAILED exam isn't
 *   a future commitment).
 * - When updating an existing class or exam, pass its id in
 *   `excludeClassId`/`excludeExamId` so the row doesn't conflict with itself.
 * - Recurring class creation passes one window per occurrence; the query
 *   batches them into a single OR rather than firing N queries.
 */
export async function hasInstructorScheduleConflict({
  db,
  tenantId,
  instructorId,
  windows,
  excludeClassId,
  excludeExamId,
}: {
  db: PrismaClient;
  tenantId: string;
  instructorId: string;
  windows: Window[];
  excludeClassId?: string;
  excludeExamId?: string;
}): Promise<boolean> {
  if (windows.length === 0) return false;

  const classOR = windows.map((w) => ({
    startsAt: { lt: w.endsAt },
    endsAt: { gt: w.startsAt },
  }));

  // Exam covers [scheduledAt, scheduledAt + 60min]. Overlaps a window
  // [startsAt, endsAt] iff scheduledAt < endsAt AND scheduledAt > startsAt - 60min.
  const examOR = windows.map((w) => ({
    scheduledAt: {
      lt: w.endsAt,
      gt: new Date(w.startsAt.getTime() - EXAM_DURATION_MS),
    },
  }));

  const [classConflict, examConflict] = await Promise.all([
    db.classSession.findFirst({
      where: {
        tenantId,
        instructorId,
        status: { not: "CANCELLED" },
        ...(excludeClassId && { id: { not: excludeClassId } }),
        OR: classOR,
      },
      select: { id: true },
    }),
    db.exam.findFirst({
      where: {
        tenantId,
        instructorId,
        result: "SCHEDULED",
        ...(excludeExamId && { id: { not: excludeExamId } }),
        OR: examOR,
      },
      select: { id: true },
    }),
  ]);

  return classConflict !== null || examConflict !== null;
}

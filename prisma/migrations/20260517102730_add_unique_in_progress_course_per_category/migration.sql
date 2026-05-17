-- Defence-in-depth: a student can have only ONE IN_PROGRESS StudentCourse
-- per category at a time. The tRPC layer already enforces this on create,
-- but a partial unique index makes the DB enforce it too — protecting
-- against races, future endpoint bugs that forget the check, or raw SQL.
--
-- COMPLETED and ABANDONED rows are not constrained, so a student can have
-- many of those (e.g. start Cat B → abandon → start Cat B again later).
--
-- Prisma doesn't support partial unique indexes in schema.prisma syntax,
-- so this is a hand-written migration with no corresponding schema change.

CREATE UNIQUE INDEX "student_course_one_active_per_category"
  ON "student_courses" ("student_id", "category")
  WHERE "status" = 'IN_PROGRESS';

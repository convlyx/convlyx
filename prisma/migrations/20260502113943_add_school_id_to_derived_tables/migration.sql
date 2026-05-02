-- Denormalize school_id onto Enrollment, Notification, StudentCourse so
-- school-level scoping doesn't depend on traversing FK chains. Backfilled
-- from each table's natural parent before applying NOT NULL + FK + index.

-- ── Enrollment ──────────────────────────────────────────────────────────
ALTER TABLE "enrollments" ADD COLUMN "school_id" UUID;

UPDATE "enrollments" e
SET "school_id" = c."school_id"
FROM "class_sessions" c
WHERE e."session_id" = c."id";

ALTER TABLE "enrollments" ALTER COLUMN "school_id" SET NOT NULL;

ALTER TABLE "enrollments"
  ADD CONSTRAINT "enrollments_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "enrollments_school_id_idx" ON "enrollments"("school_id");

-- ── Notification ────────────────────────────────────────────────────────
ALTER TABLE "notifications" ADD COLUMN "school_id" UUID;

UPDATE "notifications" n
SET "school_id" = u."school_id"
FROM "users" u
WHERE n."user_id" = u."id";

ALTER TABLE "notifications" ALTER COLUMN "school_id" SET NOT NULL;

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "notifications_school_id_idx" ON "notifications"("school_id");

-- ── StudentCourse ───────────────────────────────────────────────────────
ALTER TABLE "student_courses" ADD COLUMN "school_id" UUID;

UPDATE "student_courses" sc
SET "school_id" = u."school_id"
FROM "users" u
WHERE sc."student_id" = u."id";

ALTER TABLE "student_courses" ALTER COLUMN "school_id" SET NOT NULL;

ALTER TABLE "student_courses"
  ADD CONSTRAINT "student_courses_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "student_courses_school_id_idx" ON "student_courses"("school_id");

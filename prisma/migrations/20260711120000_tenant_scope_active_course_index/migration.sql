-- Cross-tenant identity: a student may pursue the same category at more than
-- one school (one email, several memberships). The "one active course per
-- category" rule is therefore PER TENANT, not global.
--
-- Replace the global partial unique index with a tenant-scoped one, so a
-- student can have one IN_PROGRESS StudentCourse per category *within each
-- tenant* — but not two active courses of the same category in the same tenant.
--
-- COMPLETED / ABANDONED rows remain unconstrained (start → abandon → restart).
-- Prisma can't express partial unique indexes, so this stays hand-written.

DROP INDEX IF EXISTS "student_course_one_active_per_category";

CREATE UNIQUE INDEX "student_course_one_active_per_category"
  ON "student_courses" ("tenant_id", "student_id", "category")
  WHERE "status" = 'IN_PROGRESS';

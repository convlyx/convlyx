# License Categories & Exams — Design Decisions

**Date:** 2026-04-29
**Context:** Adding Portuguese IMT license category tracking and theory/practical exam scheduling/results.

## Categories supported

All 14 Portuguese IMT categories: `AM, A1, A2, A, B1, B, BE, C1, C1E, C, D1, D1E, D, DE`.
Min-age metadata lives in code (`src/lib/license-categories.ts`), not in the database.

## Decisions

### D1 — Single active category per student (history preserved)

Students can only pursue **one** license category at a time. We model this with a `StudentCourse` table rather than a single field on `User`, so the full history of completed/abandoned courses is preserved (a student finishing B and then doing A is a real workflow).

Constraint enforced at the tRPC layer (`course.start` rejects if `IN_PROGRESS` already exists for the student). Defense-in-depth Postgres partial unique index is logged as follow-up in `FUTURE.md`.

### D2 — `ClassSession.category` is required

Every class is tagged with a category. Theory content for B differs from A, so this is required for filtering, reporting, and student-facing calendar relevance.

Column is **nullable in the DB** (legacy rows from before this feature) but **required at the validation layer** for new/edited classes. Backfill is logged as a follow-up.

### D3 — `User.qualifiedCategories[]` for instructors

Instructors carry an array of categories they're qualified to teach. Used to filter the instructor dropdown when creating/editing a class for a given category, and the accompanying-instructor dropdown when scheduling a practical exam.

Empty array on non-instructors (unused but harmless).

### D4 — No explicit `Enrollment.courseId` link

Since a student can only have one active course, the relevant course is **inferred** from the student's `IN_PROGRESS` `StudentCourse`. Avoids redundant FK and keeps enrollment writes simpler.

### D5 — Per-attempt `Exam` rows

Each exam attempt is its own row with its own `result` (`SCHEDULED | PASSED | FAILED | NO_SHOW | CANCELLED`). Students retake exams; the school cares about retake history (and IMT compliance reports later).

### D6 — Separate `Exam` model on the calendar (not a `ClassSession.type = EXAM`)

Exams have a fundamentally different lifecycle from classes (result vs attendance, external examiner vs internal instructor, no enrollments, no capacity). Reusing `ClassSession` would muddy the model. Calendar unions `class.list` and `exam.list` results client-side; events are prefixed with `exam:` to disambiguate clicks.

### D7 — Both theory and practical exams in calendar

Same model handles both, filterable by type. Lets staff/students see the full exam plan alongside lessons.

### D8 — Role permissions

- **Admin / Secretary**: schedule, edit, cancel exams; record any result.
- **Instructor**: can mark `NO_SHOW` only on exams they accompany (someone has to record it if the student doesn't show up).
- **Student**: read-only on their own exams.

### D9 — Notifications

Scheduling, result recording, and cancellation all fire notifications (student + accompanying instructor). The existing daily reminder cron now also covers tomorrow's exams.

## Files of interest

- Schema: `prisma/schema.prisma` (enums `LicenseCategory`, `CourseStatus`, `ExamType`, `ExamResult`; tables `student_courses`, `exams`; column `class_sessions.category`; column `users.qualified_categories`)
- Shared: `src/lib/license-categories.ts`
- Validation: `src/lib/validations/{course,exam,class,user}.ts`
- Routers: `src/server/routers/{course,exam,class,user}.ts`
- UI: `src/components/category-{select,multi-select,badge}.tsx`, `src/app/(dashboard)/students/[id]/_components/{courses-and-exams-section,start-course-dialog,schedule-exam-dialog,record-exam-result-dialog}.tsx`, `src/app/(dashboard)/calendar/_components/exam-detail-dialog.tsx`
- Cron: `src/app/api/cron/reminders/route.ts`

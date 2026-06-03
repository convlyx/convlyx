# Student Schedule Conflicts — Decisions

**Date:** 2026-06-03
**Context:** Conflict detection only ever covered the **instructor** (`hasInstructorScheduleConflict`). Nothing stopped a **student** from being booked into two overlapping commitments — overlapping class enrollments, or an exam overlapping a class. A student physically can't be in two places at once, so these are always data-entry errors.

## Decisions

### D1 — Add a student-side conflict check mirroring the instructor one

New `hasStudentScheduleConflict` in `src/server/lib/schedule-conflict.ts`. Same window-overlap logic and same 60-minute exam-slot convention as the instructor check, but resolves the student through the relations: `Enrollment → ClassSession` for classes and `Exam → StudentCourse.studentId` for exams. Cancelled classes and non-`SCHEDULED` exams are ignored.

It accepts **multiple** `studentIds` so a whole roster is checked in a single query per relation (one OR per window), and takes `excludeSessionId` / `excludeExamId` so an item doesn't conflict with itself when rescheduled.

### D2 — Enforce on every booking path

Wired into the four paths that can create an overlap for a student:
- `enrollment.enroll` — skipped for `COMPLETED` sessions (recorded retroactively, not booked).
- `class.create` — checks the assigned `studentIds` before the session is created.
- `class.update` — re-checks already-enrolled students against the new time (`excludeSessionId` = the class itself).
- `exam.schedule` / `exam.update` — checks the course's student; runs regardless of whether an accompanying instructor is set.

### D3 — Hard block for everyone (no staff override)

Consistent with how the instructor conflict already behaves: staff get no force/override path. An overlap is virtually always a mistake, and adding an override only for students would be inconsistent and require threading a force flag through tRPC + confirmation UIs. If a genuine override need ever appears, it should be added for instructor and student conflicts together.

### D4 — Static, neutral error messages

The client renders tRPC error messages via `t(error.message)` with no parameter interpolation, so messages stay static keys (no student name). Neutral phrasing works whether the message is shown to staff or to a self-enrolling student:
- `classes.studentScheduleConflict` — "Um dos alunos já tem uma aula ou exame marcado neste horário"
- `exams.studentScheduleConflict` — "O aluno já tem uma aula ou exame marcado neste horário"
- `enrollments.studentScheduleConflict` — "Já existe uma aula ou exame marcado neste horário"

## Tests

`tests/student-schedule.test.ts` — covers enroll, class.create, and exam.schedule rejections plus a non-overlapping success case. Paths that also check the instructor use a second, free instructor so the instructor guard can't mask the student guard.

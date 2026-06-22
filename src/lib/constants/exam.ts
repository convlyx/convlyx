// Exam result statuses — shared labels + styling so the badge (exam detail
// dialog) and the calendar event colours stay in lockstep. Add a new result
// status here once and both surfaces pick it up.

// Translation keys for each result status.
export const examResultKeys: Record<string, string> = {
  SCHEDULED: "exams.scheduledStatus",
  PASSED: "exams.passedStatus",
  FAILED: "exams.failedStatus",
  NO_SHOW: "exams.noShowStatus",
  CANCELLED: "exams.cancelledStatus",
};

// Badge variants for each result status.
export const examResultVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  SCHEDULED: "secondary",
  PASSED: "default",
  FAILED: "destructive",
  NO_SHOW: "destructive",
  CANCELLED: "outline",
};

// Calendar event colours per result — read CSS variables defined in
// `src/app/globals.css` (light + dark variants live there).
export const examResultColors: Record<string, { bg: string; border: string }> = {
  SCHEDULED: {
    bg: "var(--calendar-exam-scheduled-bg)",
    border: "var(--calendar-exam-scheduled-border)",
  },
  PASSED: {
    bg: "var(--calendar-exam-passed-bg)",
    border: "var(--calendar-exam-passed-border)",
  },
  FAILED: {
    bg: "var(--calendar-exam-failed-bg)",
    border: "var(--calendar-exam-failed-border)",
  },
  NO_SHOW: {
    bg: "var(--calendar-exam-failed-bg)",
    border: "var(--calendar-exam-failed-border)",
  },
  CANCELLED: {
    bg: "var(--calendar-exam-cancelled-bg)",
    border: "var(--calendar-exam-cancelled-border)",
  },
};

// Class type translation keys
export const typeKeys: Record<string, string> = {
  THEORY: "classes.theory",
  PRACTICAL: "classes.practical",
};

export type ClassStatusValue = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

/**
 * The effective lifecycle status of a class *right now*. Class rows are NOT
 * transitioned by a cron — the stored `status` only reliably captures CANCELLED
 * (and an early IN_PROGRESS when a theory check-in is opened). Everything else
 * is derived from the clock so an ended class actually reads as COMPLETED and
 * a running one as IN_PROGRESS. Use this for display + gating, never the raw
 * stored `status`, so behaviour doesn't depend on a background job.
 */
export function effectiveClassStatus(
  session: { status: string; startsAt: string | Date; endsAt: string | Date },
  now: Date = new Date(),
): ClassStatusValue {
  if (session.status === "CANCELLED") return "CANCELLED";
  const t = now.getTime();
  if (t >= new Date(session.endsAt).getTime()) return "COMPLETED";
  if (t >= new Date(session.startsAt).getTime()) return "IN_PROGRESS";
  return "SCHEDULED";
}

/**
 * Whether a STUDENT may self-enroll into a class. Practical self-enrollment is
 * a per-school opt-in (`practicalSelfEnrollEnabled`); theory is always open.
 * Gates both the "Inscrever" button and whether an un-enrolled practical class
 * appears in the student browse list. Mirrors the server rule enforced in
 * `enrollment.enroll` — if this returns false the mutation would reject anyway.
 */
export function studentCanSelfEnroll(cls: {
  classType: string;
  school: { practicalSelfEnrollEnabled: boolean };
}): boolean {
  return cls.classType !== "PRACTICAL" || cls.school.practicalSelfEnrollEnabled;
}

// Class status translation keys
export const statusKeys: Record<string, string> = {
  SCHEDULED: "classes.scheduled",
  IN_PROGRESS: "classes.inProgress",
  COMPLETED: "classes.completed",
  CANCELLED: "classes.cancelled",
};

// Class status badge variants
export const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  SCHEDULED: "outline",
  IN_PROGRESS: "default",
  COMPLETED: "secondary",
  CANCELLED: "destructive",
};

// Enrollment status translation keys
export const enrollmentStatusKeys: Record<string, string> = {
  ENROLLED: "enrollments.enrolled",
  ATTENDED: "enrollments.attended",
  NO_SHOW: "enrollments.noShow",
  CANCELLED: "enrollments.cancelled",
  NO_RECORD: "enrollments.noRecord",
};

// Enrollment status badge variants
export const enrollmentStatusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ENROLLED: "default",
  ATTENDED: "secondary",
  NO_SHOW: "destructive",
  CANCELLED: "outline",
  NO_RECORD: "outline",
};

// Role avatar color classes
export const roleColorMap: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  SECRETARY: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  INSTRUCTOR: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  STUDENT: "bg-primary/10 text-primary",
};

// Class type icon background classes
export const classTypeColorMap: Record<string, string> = {
  THEORY: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  PRACTICAL: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
};

/**
 * Resolve display status for an enrollment.
 * ENROLLED on a COMPLETED class = NO_RECORD (attendance was never marked).
 */
export function resolveEnrollmentDisplay(enrollmentStatus: string, classStatus: string): string {
  if (enrollmentStatus === "ENROLLED" && classStatus === "COMPLETED") {
    return "NO_RECORD";
  }
  return enrollmentStatus;
}

// Class type badge classes (for inline badges)
export const classTypeBadgeClass: Record<string, string> = {
  THEORY: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  PRACTICAL: "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
};

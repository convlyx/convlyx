// Class type translation keys
export const typeKeys: Record<string, string> = {
  THEORY: "classes.theory",
  PRACTICAL: "classes.practical",
};

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
  ENROLLED: "enrollment.enrolled",
  ATTENDED: "enrollment.attended",
  NO_SHOW: "enrollment.noShow",
  NO_RECORD: "enrollment.noRecord",
};

// Enrollment status badge variants
export const enrollmentStatusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ENROLLED: "default",
  ATTENDED: "secondary",
  NO_SHOW: "destructive",
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

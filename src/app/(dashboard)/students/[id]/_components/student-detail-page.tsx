"use client";

import { DetailBackLink } from "@/app/(dashboard)/_components/detail-back-link";
import { StudentHeaderSection } from "./student-header-section";
import { StudentStatsSection } from "./student-stats-section";
import { CoursesAndExamsSection } from "./courses-and-exams-section";
import { StudentHistorySection } from "./student-history-section";
import { StudentDangerZoneSection } from "./student-danger-zone-section";
import type { UserRole } from "@/generated/prisma/enums";

/**
 * Orchestrator only — each child section owns its own tRPC query and
 * skeleton so they progressively reveal as data arrives instead of
 * blocking on one monolithic profile fetch. Sections that need the
 * same data (header, overview) hit the same TanStack cache key so
 * there's still one network call per endpoint.
 */
export function StudentDetailPage({
  id,
  userRole,
}: {
  id: string;
  userRole: UserRole;
}) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <DetailBackLink href="/students" />

      <StudentHeaderSection id={id} userRole={userRole} />
      <StudentStatsSection id={id} />
      <CoursesAndExamsSection studentId={id} userRole={userRole} />
      <StudentHistorySection id={id} />
      <StudentDangerZoneSection id={id} userRole={userRole} />
    </div>
  );
}

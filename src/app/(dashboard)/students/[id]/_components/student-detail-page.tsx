"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const t = useTranslations();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Link href="/students" className="inline-flex">
        <Button variant="ghost" size="sm" className="gap-2 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {t("common.back")}
        </Button>
      </Link>

      <StudentHeaderSection id={id} userRole={userRole} />
      <StudentStatsSection id={id} />
      <CoursesAndExamsSection studentId={id} userRole={userRole} />
      <StudentHistorySection id={id} />
      <StudentDangerZoneSection id={id} userRole={userRole} />
    </div>
  );
}

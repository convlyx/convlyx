"use client";

import { useTranslations } from "next-intl";
import { ClassesTable } from "./classes-table";
import type { UserRole } from "@/generated/prisma/enums";
import { PageHeader } from "@/components/page-header";

export function ClassesPageClient({ userRole, userId }: { userRole: UserRole; userId: string }) {
  const t = useTranslations("classes");
  // STUDENT/INSTRUCTOR get the mobile shell, whose curved header already shows
  // the screen title — so only render the in-content title for staff (desktop).
  const showTitle = userRole === "ADMIN" || userRole === "SECRETARY";

  return (
    <div className="space-y-4">
      {showTitle && <PageHeader title={t("title")} />}
      <ClassesTable userRole={userRole} userId={userId} />
    </div>
  );
}

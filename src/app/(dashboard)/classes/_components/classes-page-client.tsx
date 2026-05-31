"use client";

import { useTranslations } from "next-intl";
import { ClassesTable } from "./classes-table";
import type { UserRole } from "@/generated/prisma/enums";

export function ClassesPageClient({ userRole, userId }: { userRole: UserRole; userId: string }) {
  const t = useTranslations("classes");
  // STUDENT/INSTRUCTOR get the mobile shell, whose curved header already shows
  // the screen title — so only render the in-content title for staff (desktop).
  const showTitle = userRole === "ADMIN" || userRole === "SECRETARY";

  return (
    <div className="space-y-4">
      {showTitle && <h1 className="text-2xl font-bold">{t("title")}</h1>}
      <ClassesTable userRole={userRole} userId={userId} />
    </div>
  );
}

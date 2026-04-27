"use client";

import { useTranslations } from "next-intl";
import { ClassesTable } from "./classes-table";
import type { UserRole } from "@/generated/prisma/enums";

export function ClassesPageClient({ userRole, userId }: { userRole: UserRole; userId: string }) {
  const t = useTranslations("classes");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <ClassesTable userRole={userRole} userId={userId} />
    </div>
  );
}

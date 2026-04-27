"use client";

import { useTranslations } from "next-intl";
import { CreateClassDialog } from "./create-class-dialog";
import { ClassesTable } from "./classes-table";
import type { UserRole } from "@/generated/prisma/enums";

export function ClassesPageClient({ userRole, userId }: { userRole: UserRole; userId: string }) {
  const t = useTranslations("classes");
  const canManage = userRole === "ADMIN" || userRole === "SECRETARY";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        {canManage && <CreateClassDialog />}
      </div>
      <ClassesTable userRole={userRole} userId={userId} />
    </div>
  );
}

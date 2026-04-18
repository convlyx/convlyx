"use client";

import { useTranslations } from "next-intl";
import { CreateUserDialog } from "./create-user-dialog";
import { UsersTable } from "./users-table";
import type { UserRole } from "@/generated/prisma/enums";

export function UsersPageClient({ userRole }: { userRole: UserRole }) {
  const t = useTranslations("users");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <CreateUserDialog />
      </div>
      <UsersTable userRole={userRole} />
    </div>
  );
}

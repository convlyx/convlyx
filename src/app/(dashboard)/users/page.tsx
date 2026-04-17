"use client";

import { useTranslations } from "next-intl";
import { CreateUserDialog } from "./_components/create-user-dialog";
import { UsersTable } from "./_components/users-table";

export default function UsersPage() {
  const t = useTranslations("users");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <CreateUserDialog />
      </div>
      <UsersTable />
    </div>
  );
}

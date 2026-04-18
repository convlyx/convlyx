"use client";

import { useTranslations } from "next-intl";
import { CreateSchoolDialog } from "./_components/create-school-dialog";
import { SchoolsTable } from "./_components/schools-table";

export default function SchoolsPage() {
  const t = useTranslations("schools");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <CreateSchoolDialog />
      </div>
      <SchoolsTable />
    </div>
  );
}

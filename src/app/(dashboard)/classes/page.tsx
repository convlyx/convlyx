"use client";

import { useTranslations } from "next-intl";
import { CreateClassDialog } from "./_components/create-class-dialog";
import { ClassesTable } from "./_components/classes-table";

export default function ClassesPage() {
  const t = useTranslations("classes");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <CreateClassDialog />
      </div>
      <ClassesTable />
    </div>
  );
}

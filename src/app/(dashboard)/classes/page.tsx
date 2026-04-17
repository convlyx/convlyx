"use client";

import { useTranslations } from "next-intl";
import { CreateClassDialog } from "./_components/create-class-dialog";
import { ClassesTable } from "./_components/classes-table";

export default function ClassesPage() {
  const t = useTranslations("classes");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <CreateClassDialog />
      </div>
      <ClassesTable />
    </div>
  );
}

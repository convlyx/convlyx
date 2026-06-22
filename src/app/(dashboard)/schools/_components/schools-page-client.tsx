"use client";

import { useTranslations } from "next-intl";
import { CreateSchoolDialog } from "./create-school-dialog";
import { SchoolsTable } from "./schools-table";
import { PageHeader } from "@/components/page-header";

export function SchoolsPageClient() {
  const t = useTranslations("schools");

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")}>
        <CreateSchoolDialog />
      </PageHeader>
      <SchoolsTable />
    </div>
  );
}

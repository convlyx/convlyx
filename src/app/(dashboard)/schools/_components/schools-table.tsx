"use client";

import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Building2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function SchoolsTable() {
  const t = useTranslations();
  const { data: schools, isLoading } = trpc.school.list.useQuery();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  if (!schools || schools.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Building2 className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">{t("schools.noSchools")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border card-shadow overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("common.name")}</TableHead>
            <TableHead>{t("common.address")}</TableHead>
            <TableHead>{t("common.phone")}</TableHead>
            <TableHead>{t("nav.students")}</TableHead>
            <TableHead>{t("nav.classes")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schools.map((school) => (
            <TableRow key={school.id} className="hover:bg-muted/50 transition-colors">
              <TableCell className="font-medium">{school.name}</TableCell>
              <TableCell>{school.address ?? "—"}</TableCell>
              <TableCell>{school.phone ?? "—"}</TableCell>
              <TableCell>{school._count.users}</TableCell>
              <TableCell>{school._count.sessions}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
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
    return <p className="text-sm text-muted-foreground">{t("schools.noSchools")}</p>;
  }

  return (
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
          <TableRow key={school.id}>
            <TableCell className="font-medium">{school.name}</TableCell>
            <TableCell>{school.address ?? "—"}</TableCell>
            <TableCell>{school.phone ?? "—"}</TableCell>
            <TableCell>{school._count.users}</TableCell>
            <TableCell>{school._count.sessions}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Building2, MapPin, Phone, Users, BookOpen } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ViewToggle, useViewMode } from "@/components/view-toggle";
import { CardListSkeleton } from "@/components/skeletons/card-list-skeleton";
import { EmptyState } from "@/components/empty-state";
import { IconTile } from "@/components/icon-tile";
import { DataTableCard } from "@/components/data-table-card";

export function SchoolsTable() {
  const t = useTranslations();
  const [view, setView] = useViewMode("/schools");
  const { data: schools, isLoading } = trpc.school.list.useQuery();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ViewToggle view={view} onChange={setView} />
      </div>

      {isLoading ? (
        <CardListSkeleton />
      ) : !schools || schools.length === 0 ? (
        <EmptyState icon={Building2} message={t("schools.noSchools")} />
      ) : view === "cards" ? (
        <div className="grid gap-3 animate-in fade-in duration-300">
          {schools.map((school) => (
            <div key={school.id} className="rounded-xl border bg-card p-4 card-shadow hover:card-shadow-hover transition-all">
              <div className="flex items-start gap-3">
                <IconTile icon={Building2} className="bg-primary/10 text-primary" />
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="font-semibold truncate">{school.name}</p>
                  <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1 sm:gap-x-4 text-sm text-muted-foreground">
                    {school.address && (
                      <span className="flex items-center gap-1.5 truncate"><MapPin className="h-3.5 w-3.5 shrink-0" />{school.address}</span>
                    )}
                    {school.phone && (
                      <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 shrink-0" />{school.phone}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 pt-1">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span className="font-medium text-foreground">{school._count.memberships}</span>
                      <span className="hidden sm:inline">{t("nav.students").toLowerCase()}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <BookOpen className="h-3.5 w-3.5" />
                      <span className="font-medium text-foreground">{school._count.sessions}</span>
                      <span className="hidden sm:inline">{t("nav.classes").toLowerCase()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <DataTableCard className="animate-in fade-in duration-300">
          <Table>
            <caption className="sr-only">{t("schools.title")}</caption>
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
                  <TableCell>{school._count.memberships}</TableCell>
                  <TableCell>{school._count.sessions}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableCard>
      )}
    </div>
  );
}

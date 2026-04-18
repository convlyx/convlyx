"use client";

import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { Users, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { UserAvatar } from "@/components/user-avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ViewToggle, useViewMode } from "@/components/view-toggle";
import { Loading } from "@/components/loading";

export default function InstructorsPage() {
  const t = useTranslations();
  const [view, setView] = useViewMode("/instructors");
  const { data: users, isLoading } = trpc.user.list.useQuery({ role: "INSTRUCTOR" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("nav.instructors")}</h1>
        <ViewToggle view={view} onChange={setView} />
      </div>

      {isLoading ? (
        <Loading />
      ) : !users || users.length === 0 ? (
        <EmptyState icon={Users} message={t("common.noResults")} />
      ) : view === "cards" ? (
        <div className="grid gap-3">
          {users.map((instructor) => (
            <Link
              key={instructor.id}
              href={`/instructors/${instructor.id}`}
              className="flex items-center justify-between rounded-xl border bg-card p-4 card-shadow hover:card-shadow-hover transition-all hover:border-primary/20 group"
            >
              <div className="flex items-center gap-4">
                <UserAvatar name={instructor.name} className="h-11 w-11 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" />
                <div>
                  <p className="font-medium group-hover:text-primary transition-colors">{instructor.name}</p>
                  <p className="text-sm text-muted-foreground">{instructor.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{instructor.school.name}</Badge>
                <Badge variant={instructor.status === "ACTIVE" ? "default" : "destructive"}>
                  {instructor.status === "ACTIVE" ? t("common.active") : t("common.inactive")}
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border card-shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("auth.email")}</TableHead>
                <TableHead>{t("common.school")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((instructor) => (
                <TableRow key={instructor.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell>
                    <Link href={`/instructors/${instructor.id}`} className="font-medium text-primary hover:underline">
                      {instructor.name}
                    </Link>
                  </TableCell>
                  <TableCell>{instructor.email}</TableCell>
                  <TableCell>{instructor.school.name}</TableCell>
                  <TableCell>
                    <Badge variant={instructor.status === "ACTIVE" ? "default" : "destructive"}>
                      {instructor.status === "ACTIVE" ? t("common.active") : t("common.inactive")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

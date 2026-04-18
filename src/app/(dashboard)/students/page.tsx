"use client";

import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { GraduationCap, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ViewToggle, useViewMode } from "@/components/view-toggle";
import { Loading } from "@/components/loading";

export default function StudentsPage() {
  const t = useTranslations();
  const [view, setView] = useViewMode("/students");
  const { data: users, isLoading } = trpc.user.list.useQuery({ role: "STUDENT" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("nav.students")}</h1>
        <ViewToggle view={view} onChange={setView} />
      </div>

      {isLoading ? (
        <Loading />
      ) : !users || users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <GraduationCap className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">{t("common.noResults")}</p>
        </div>
      ) : view === "cards" ? (
        <div className="grid gap-3">
          {users.map((student) => (
            <Link
              key={student.id}
              href={`/students/${student.id}`}
              className="flex items-center justify-between rounded-xl border bg-card p-4 card-shadow hover:card-shadow-hover transition-all hover:border-primary/20 group"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                  {student.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div>
                  <p className="font-medium group-hover:text-primary transition-colors">{student.name}</p>
                  <p className="text-sm text-muted-foreground">{student.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{student.school.name}</Badge>
                <Badge variant={student.status === "ACTIVE" ? "default" : "destructive"}>
                  {student.status === "ACTIVE" ? t("common.active") : t("common.inactive")}
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
              {users.map((student) => (
                <TableRow key={student.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell>
                    <Link href={`/students/${student.id}`} className="font-medium text-primary hover:underline">
                      {student.name}
                    </Link>
                  </TableCell>
                  <TableCell>{student.email}</TableCell>
                  <TableCell>{student.school.name}</TableCell>
                  <TableCell>
                    <Badge variant={student.status === "ACTIVE" ? "default" : "destructive"}>
                      {student.status === "ACTIVE" ? t("common.active") : t("common.inactive")}
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

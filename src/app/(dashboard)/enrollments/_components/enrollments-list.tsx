"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { trpc } from "@/lib/trpc";
import { ClipboardList, BookOpen, CalendarDays, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ViewToggle, useViewMode } from "@/components/view-toggle";
import { Loading } from "@/components/loading";
import { EmptyState } from "@/components/empty-state";
import { typeKeys, enrollmentStatusKeys, enrollmentStatusVariant, classTypeColorMap } from "@/lib/constants/class";
import { toast } from "sonner";
import type { UserRole } from "@/generated/prisma/enums";

export function EnrollmentsList({ userRole }: { userRole: UserRole }) {
  const t = useTranslations();
  const format = useFormatter();
  const [view, setView] = useViewMode("/enrollments");
  const utils = trpc.useUtils();

  const { data: enrollments, isLoading } = trpc.enrollment.listByStudent.useQuery();

  const cancelMutation = trpc.enrollment.cancel.useMutation({
    onSuccess: () => {
      toast.success(t("toast.enrollmentCancelled"));
      utils.enrollment.listByStudent.invalidate();
      utils.class.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const [timeTab, setTimeTab] = useState<"current" | "past">("current");

  const canCancel = (enrollment: { status: string; session: { status: string } }) =>
    userRole === "STUDENT" && enrollment.status === "ENROLLED" && enrollment.session.status === "SCHEDULED";

  const now = new Date();
  const filteredEnrollments = enrollments?.filter((e) => {
    if (timeTab === "current") {
      return e.status === "ENROLLED" && new Date(e.session.startsAt as unknown as string) >= now;
    }
    return e.status !== "ENROLLED" || new Date(e.session.startsAt as unknown as string) < now;
  }) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">{t("enrollment.myEnrollments")}</h1>
        <ViewToggle view={view} onChange={setView} />
      </div>

      {/* Time tabs */}
      <div className="flex items-center gap-1 rounded-lg border p-0.5 w-fit">
        <Button
          variant={timeTab === "current" ? "default" : "ghost"}
          size="sm"
          onClick={() => setTimeTab("current")}
        >
          {t("classes.upcoming")}
        </Button>
        <Button
          variant={timeTab === "past" ? "default" : "ghost"}
          size="sm"
          onClick={() => setTimeTab("past")}
        >
          {t("classes.past")}
        </Button>
      </div>

      {isLoading ? (
        <Loading />
      ) : filteredEnrollments.length === 0 ? (
        <EmptyState icon={ClipboardList} message={t("common.noResults")} />
      ) : view === "cards" ? (
        <div className="grid gap-3">
          {filteredEnrollments.map((enrollment) => (
            <div
              key={enrollment.id}
              className="rounded-xl border bg-card p-4 card-shadow hover:card-shadow-hover transition-all"
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl ${classTypeColorMap[enrollment.session.classType]}`}>
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-medium truncate">{enrollment.session.title}</p>
                    <Badge variant="secondary">{t(typeKeys[enrollment.session.classType])}</Badge>
                    <Badge variant={enrollmentStatusVariant[enrollment.status] ?? "outline"}>
                      {t(enrollmentStatusKeys[enrollment.status] ?? enrollment.status)}
                    </Badge>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1 truncate"><Users className="h-3.5 w-3.5 shrink-0" />{enrollment.session.instructor.name}</span>
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      {format.dateTime(new Date(enrollment.session.startsAt), { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      {" · "}
                      {format.dateTime(new Date(enrollment.session.endsAt), { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {canCancel(enrollment) && (
                    <div className="mt-2 sm:hidden">
                      <Button variant="destructive" size="sm" className="w-full" disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate({ enrollmentId: enrollment.id })}>
                        {t("enrollment.cancel")}
                      </Button>
                    </div>
                  )}
                </div>
                {canCancel(enrollment) && (
                  <div className="hidden sm:block shrink-0">
                    <Button variant="destructive" size="sm" disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate({ enrollmentId: enrollment.id })}>
                      {t("enrollment.cancel")}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border card-shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("classes.type")}</TableHead>
                <TableHead>{t("classes.instructor")}</TableHead>
                <TableHead>{t("classes.date")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                {userRole === "STUDENT" && <TableHead>{t("common.actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEnrollments.map((enrollment) => (
                <TableRow key={enrollment.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium">{enrollment.session.title}</TableCell>
                  <TableCell><Badge variant="secondary">{t(typeKeys[enrollment.session.classType])}</Badge></TableCell>
                  <TableCell>{enrollment.session.instructor.name}</TableCell>
                  <TableCell>
                    {format.dateTime(new Date(enrollment.session.startsAt), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    {format.dateTime(new Date(enrollment.session.endsAt), { hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={enrollmentStatusVariant[enrollment.status] ?? "outline"}>
                      {t(enrollmentStatusKeys[enrollment.status] ?? enrollment.status)}
                    </Badge>
                  </TableCell>
                  {userRole === "STUDENT" && (
                    <TableCell>
                      {canCancel(enrollment) && (
                        <Button variant="destructive" size="sm" disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate({ enrollmentId: enrollment.id })}>
                          {t("enrollment.cancel")}
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

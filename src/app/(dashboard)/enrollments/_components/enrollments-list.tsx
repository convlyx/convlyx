"use client";

import { useTranslations, useFormatter } from "next-intl";
import { trpc } from "@/lib/trpc";
import { ClipboardList } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/generated/prisma/enums";

const typeKeys: Record<string, string> = {
  THEORY: "classes.theory",
  PRACTICAL: "classes.practical",
};

const enrollmentStatusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ENROLLED: "default",
  ATTENDED: "secondary",
  NO_SHOW: "destructive",
  CANCELLED: "outline",
};

const enrollmentStatusKeys: Record<string, string> = {
  ENROLLED: "enrollment.enrolled",
  ATTENDED: "enrollment.attended",
  NO_SHOW: "enrollment.noShow",
  CANCELLED: "common.cancel",
};

export function EnrollmentsList({ userRole }: { userRole: UserRole }) {
  const t = useTranslations();
  const format = useFormatter();
  const utils = trpc.useUtils();

  const { data: enrollments, isLoading } = trpc.enrollment.listByStudent.useQuery();

  const cancelMutation = trpc.enrollment.cancel.useMutation({
    onSuccess: () => {
      utils.enrollment.listByStudent.invalidate();
      utils.class.list.invalidate();
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("enrollment.myEnrollments")}</h1>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : !enrollments || enrollments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <ClipboardList className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">{t("common.noResults")}</p>
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
              {enrollments.map((enrollment) => (
                <TableRow key={enrollment.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium">{enrollment.session.title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {t(typeKeys[enrollment.session.classType])}
                    </Badge>
                  </TableCell>
                  <TableCell>{enrollment.session.instructor.name}</TableCell>
                  <TableCell>
                    {format.dateTime(new Date(enrollment.session.startsAt), {
                      day: "2-digit", month: "2-digit", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                    {" — "}
                    {format.dateTime(new Date(enrollment.session.endsAt), {
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={enrollmentStatusVariant[enrollment.status] ?? "outline"}>
                      {t(enrollmentStatusKeys[enrollment.status] ?? enrollment.status)}
                    </Badge>
                  </TableCell>
                  {userRole === "STUDENT" && (
                    <TableCell>
                      {enrollment.status === "ENROLLED" && enrollment.session.status === "SCHEDULED" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={cancelMutation.isPending}
                          onClick={() => cancelMutation.mutate({ enrollmentId: enrollment.id })}
                        >
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

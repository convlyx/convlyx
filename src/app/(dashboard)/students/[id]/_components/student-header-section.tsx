"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GraduationCap,
  Mail,
  Phone,
  Building2,
  Camera,
  Clock,
  FileDown,
  Pencil,
} from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useTranslatedError } from "@/hooks/use-translated-error";
import { EditUserDialog } from "@/app/(dashboard)/_components/edit-user-dialog";
import { exportStudentProgressPDF } from "@/lib/pdf-export";
import type { UserRole } from "@/generated/prisma/enums";

type Props = {
  id: string;
  userRole: UserRole;
};

export function StudentHeaderSection({ id, userRole }: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const { onError } = useTranslatedError();
  const utils = trpc.useUtils();

  const [showEdit, setShowEdit] = useState(false);
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data: student, isLoading } = trpc.user.studentHeader.useQuery({ id });

  const deactivateMutation = trpc.user.deactivate.useMutation({
    onSuccess: () => {
      toast.success(t("toast.userDeactivated"));
      utils.user.list.invalidate();
      utils.user.studentHeader.invalidate({ id });
    },
    onError,
  });

  const activateMutation = trpc.user.activate.useMutation({
    onSuccess: () => {
      toast.success(t("toast.userActivated"));
      utils.user.list.invalidate();
      utils.user.studentHeader.invalidate({ id });
    },
    onError,
  });

  const canManage = userRole === "ADMIN" || userRole === "SECRETARY";

  if (isLoading) {
    return <StudentHeaderSkeleton />;
  }

  if (!student) {
    return <p className="text-sm text-destructive p-6">{t("users.notFound")}</p>;
  }

  // The top-level PDF needs the full enrollment list; we fetch it on
  // demand so the page doesn't pay for it upfront. Header + stats come
  // from already-warm caches via studentProfile (which still bundles
  // everything for export consumers).
  async function handleExportPDF() {
    setExporting(true);
    try {
      const full = await utils.user.studentProfile.fetch({ id });
      await exportStudentProgressPDF(full);
    } catch {
      toast.error(t("errors.unexpected"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6 rounded-xl border bg-card p-4 sm:p-6 card-shadow">
        <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary self-start">
          <GraduationCap className="h-7 w-7 sm:h-8 sm:w-8" />
          <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-muted border-2 border-card">
            <Camera className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold leading-tight">{student.name}</h1>
              <Badge variant={student.status === "ACTIVE" ? "default" : "destructive"}>
                {student.status === "ACTIVE" ? t("common.active") : t("common.inactive")}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2 sm:shrink-0">
              {canManage && !student.anonymized && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setShowEdit(true)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {t("common.edit")}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={exporting}
                onClick={handleExportPDF}
              >
                <FileDown className="h-3.5 w-3.5" />
                {t("common.exportPDF")}
              </Button>
              {/* Activate / deactivate doesn't apply to anonymized users —
                  there's no real account to (re-)enable. */}
              {canManage && !student.anonymized && (student.status === "ACTIVE" ? (
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5"
                  disabled={deactivateMutation.isPending}
                  onClick={() => setShowDeactivate(true)}
                >
                  {t("users.deactivate")}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={activateMutation.isPending}
                  onClick={() => activateMutation.mutate({ id })}
                >
                  {t("users.activate")}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5 min-w-0">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{student.email}</span>
            </span>
            {student.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                {student.phone}
              </span>
            )}
            <span className="flex items-center gap-1.5 min-w-0">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{student.school.name}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              {t("users.memberSince")} {format.dateTime(new Date(student.createdAt), { month: "long", year: "numeric" })}
            </span>
          </div>
        </div>
      </div>

      {showEdit && (
        <EditUserDialog
          userData={{ ...student, role: "STUDENT" }}
          open={showEdit}
          onClose={() => {
            setShowEdit(false);
            utils.user.studentHeader.invalidate({ id });
          }}
        />
      )}

      <ConfirmDialog
        open={showDeactivate}
        onClose={() => setShowDeactivate(false)}
        onConfirm={() => {
          deactivateMutation.mutate({ id });
          setShowDeactivate(false);
        }}
        title={t("users.deactivateTitle")}
        message={t("users.deactivateMessage")}
        loading={deactivateMutation.isPending}
      />
    </>
  );
}

function StudentHeaderSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 sm:p-6 card-shadow">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
        <Skeleton className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
    </div>
  );
}

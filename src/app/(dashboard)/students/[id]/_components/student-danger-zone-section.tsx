"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Trash2 } from "lucide-react";
import { useTranslatedError } from "@/hooks/use-translated-error";
import type { UserRole } from "@/generated/prisma/enums";

export function StudentDangerZoneSection({
  id,
  userRole,
}: {
  id: string;
  userRole: UserRole;
}) {
  const t = useTranslations();
  const router = useRouter();
  const utils = trpc.useUtils();
  const { onError } = useTranslatedError();

  const [showDelete, setShowDelete] = useState(false);
  const [showAnonymize, setShowAnonymize] = useState(false);

  const { data: student } = trpc.user.studentHeader.useQuery({ id });

  const deleteMutation = trpc.user.delete.useMutation({
    onSuccess: () => {
      toast.success(t("toast.userDeleted"));
      utils.user.list.invalidate();
      router.push("/students");
    },
    onError,
  });

  const anonymizeMutation = trpc.user.anonymize.useMutation({
    onSuccess: () => {
      toast.success(t("toast.userAnonymized"));
      utils.user.list.invalidate();
      utils.user.studentHeader.invalidate({ id });
      utils.user.studentOverview.invalidate({ id });
      setShowAnonymize(false);
    },
    onError,
  });

  const canDelete = userRole === "ADMIN";

  // Hide entirely until the header data has resolved so we know whether
  // this user is anonymized / deletable. No skeleton — the zone is a
  // background-of-page concern that doesn't need to advertise its own
  // loading state.
  if (!canDelete || !student || student.anonymized) {
    return null;
  }

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-4 border-t">
        <p className="text-sm text-muted-foreground">{t("users.dangerZoneDescription")}</p>
        {student.deletable ? (
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5 sm:shrink-0"
            onClick={() => setShowDelete(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("users.delete")}
          </Button>
        ) : (
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5 sm:shrink-0"
            onClick={() => setShowAnonymize(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("users.anonymize")}
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => deleteMutation.mutate({ id })}
        title={t("users.deleteTitle")}
        message={t("users.deleteMessage")}
        confirmLabel={t("users.delete")}
        loading={deleteMutation.isPending}
      />

      <ConfirmDialog
        open={showAnonymize}
        onClose={() => setShowAnonymize(false)}
        onConfirm={() => anonymizeMutation.mutate({ id })}
        title={t("users.anonymizeTitle")}
        message={t("users.anonymizeMessage")}
        confirmLabel={t("users.anonymize")}
        loading={anonymizeMutation.isPending}
      />
    </>
  );
}

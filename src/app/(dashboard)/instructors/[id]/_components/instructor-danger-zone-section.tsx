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

export function InstructorDangerZoneSection({
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

  const { data: instructor } = trpc.user.instructorHeader.useQuery({ id });

  const deleteMutation = trpc.user.delete.useMutation({
    onSuccess: () => {
      toast.success(t("toast.userDeleted"));
      utils.user.list.invalidate();
      router.push("/instructors");
    },
    onError,
  });

  const anonymizeMutation = trpc.user.anonymize.useMutation({
    onSuccess: () => {
      toast.success(t("toast.userAnonymized"));
      utils.user.list.invalidate();
      utils.user.instructorHeader.invalidate({ id });
      setShowAnonymize(false);
    },
    onError,
  });

  const canDelete = userRole === "ADMIN";

  if (!canDelete || !instructor || instructor.anonymized) {
    return null;
  }

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-4 border-t">
        <p className="text-sm text-muted-foreground">{t("users.dangerZoneDescription")}</p>
        {instructor.deletable ? (
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

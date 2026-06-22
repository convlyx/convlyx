"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useTranslatedError } from "@/hooks/use-translated-error";

/**
 * Shared GDPR danger zone for user detail pages. Deletes a user when they have
 * no historical records, otherwise anonymizes. The header data (anonymized /
 * deletable) is fetched by the caller — which calls the same query key as the
 * page header, so TanStack dedupes it to one network call. Renders nothing
 * until that data resolves, or when the viewer can't delete / already anonymized.
 */
export function DangerZoneSection({
  id,
  canDelete,
  anonymized,
  deletable,
  listPath,
  onAnonymized,
}: {
  id: string;
  canDelete: boolean;
  anonymized: boolean | undefined;
  deletable: boolean | undefined;
  listPath: string;
  onAnonymized?: () => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const utils = trpc.useUtils();
  const { onError } = useTranslatedError();

  const [showDelete, setShowDelete] = useState(false);
  const [showAnonymize, setShowAnonymize] = useState(false);

  const deleteMutation = trpc.user.delete.useMutation({
    onSuccess: () => {
      toast.success(t("toast.userDeleted"));
      utils.user.list.invalidate();
      router.push(listPath);
    },
    onError,
  });

  const anonymizeMutation = trpc.user.anonymize.useMutation({
    onSuccess: () => {
      toast.success(t("toast.userAnonymized"));
      utils.user.list.invalidate();
      onAnonymized?.();
      setShowAnonymize(false);
    },
    onError,
  });

  // Hide until header data resolves (so we know anonymized / deletable) and
  // when the viewer can't delete or the user is already anonymized.
  if (!canDelete || anonymized === undefined || anonymized) {
    return null;
  }

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-4 border-t">
        <p className="text-sm text-muted-foreground">{t("users.dangerZoneDescription")}</p>
        {deletable ? (
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

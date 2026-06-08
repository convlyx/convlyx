"use client";

import { useTranslations } from "next-intl";
import { CheckCircle, QrCode } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

export function CheckInConfirm({ sessionId, token }: { sessionId: string; token: string }) {
  const t = useTranslations("checkin");
  const tRoot = useTranslations();
  const { data: cls } = trpc.class.getById.useQuery({ id: sessionId });
  const checkIn = trpc.enrollment.checkIn.useMutation();

  // Reload-safe: if this student's enrolment is already ATTENDED, show the
  // confirmed state immediately — no second mutation, no double enrolment
  // (also guarded server-side by the idempotent mutation + unique constraint).
  const alreadyAttended = cls?.enrollments?.some((e) => e.status === "ATTENDED") ?? false;
  const marked = checkIn.isSuccess || alreadyAttended;
  const wasAlready = checkIn.data?.alreadyMarked ?? (alreadyAttended && !checkIn.isSuccess);

  if (marked) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
        <CheckCircle className="h-16 w-16 text-emerald-500" />
        <h1 className="text-xl font-bold">{t("marked")}</h1>
        {wasAlready && <p className="text-muted-foreground">{t("alreadyMarked")}</p>}
        <p className="font-medium">{checkIn.data?.title ?? cls?.title}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-xl font-bold">{t("confirmTitle")}</h1>
      {cls && <p className="text-lg font-medium">{cls.title}</p>}

      {token ? (
        <>
          <p className="text-muted-foreground">{t("confirmHint")}</p>
          <Button
            size="lg"
            disabled={checkIn.isPending}
            onClick={() => checkIn.mutate({ sessionId, token })}
          >
            {t("confirmButton")}
          </Button>
        </>
      ) : (
        <p className="flex max-w-xs items-center gap-2 text-muted-foreground">
          <QrCode className="h-5 w-5 shrink-0" />
          {t("needScan")}
        </p>
      )}

      {checkIn.error && (
        <p className="text-sm font-medium text-destructive">
          {tRoot.has(checkIn.error.message as never)
            ? tRoot(checkIn.error.message as never)
            : tRoot("errors.unexpected")}
        </p>
      )}
    </div>
  );
}

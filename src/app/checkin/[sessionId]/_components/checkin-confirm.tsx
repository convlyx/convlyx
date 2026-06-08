"use client";

import { useTranslations } from "next-intl";
import { CheckCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

export function CheckInConfirm({ sessionId, token }: { sessionId: string; token: string }) {
  const t = useTranslations("checkin");
  const tRoot = useTranslations();
  const { data: cls } = trpc.class.getById.useQuery({ id: sessionId });
  const checkIn = trpc.enrollment.checkIn.useMutation();

  if (checkIn.isSuccess) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <CheckCircle className="h-16 w-16 text-emerald-500" />
        <h1 className="text-xl font-bold">{t("marked")}</h1>
        {checkIn.data.alreadyMarked && (
          <p className="text-muted-foreground">{t("alreadyMarked")}</p>
        )}
        <p className="font-medium">{checkIn.data.title}</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-bold">{t("confirmTitle")}</h1>
      {cls && <p className="text-lg font-medium">{cls.title}</p>}
      <p className="text-muted-foreground">{t("confirmHint")}</p>
      <Button
        size="lg"
        disabled={checkIn.isPending || !token}
        onClick={() => checkIn.mutate({ sessionId, token })}
      >
        {t("confirmButton")}
      </Button>
      {checkIn.error && (
        <p className="text-sm text-destructive">
          {tRoot.has(checkIn.error.message as never)
            ? tRoot(checkIn.error.message as never)
            : tRoot("errors.unexpected")}
        </p>
      )}
    </main>
  );
}

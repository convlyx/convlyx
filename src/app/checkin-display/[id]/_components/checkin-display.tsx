"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

export function CheckInDisplay({ sessionId }: { sessionId: string }) {
  const t = useTranslations("checkin");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Poll faster than the rotation window so the displayed QR stays fresh;
  // the server token tolerance covers the gap between polls.
  const { data, refetch } = trpc.class.getCheckInToken.useQuery(
    { sessionId },
    { refetchInterval: 10_000 },
  );
  const open = trpc.class.openCheckIn.useMutation({ onSuccess: () => refetch() });
  const close = trpc.class.closeCheckIn.useMutation({ onSuccess: () => refetch() });

  useEffect(() => {
    if (!canvasRef.current || !data?.checkInOpen || !data.token) return;
    const url = `${window.location.protocol}//${window.location.host}/checkin/${sessionId}?t=${data.token}`;
    QRCode.toCanvas(canvasRef.current, url, { width: 360, margin: 1 }).catch(() => {});
  }, [data?.token, data?.checkInOpen, sessionId]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-2xl font-bold">{data?.title ?? t("displayTitle")}</h1>

      {data?.checkInOpen ? (
        <>
          <div className="rounded-2xl border bg-white p-6">
            <canvas ref={canvasRef} />
          </div>
          <p className="text-muted-foreground">{t("scanToCheckIn")}</p>
          <p className="text-3xl font-bold">
            {t("presentCount", { count: data.attendedCount, capacity: data.capacity })}
          </p>
          <Button
            size="lg"
            variant="outline"
            disabled={close.isPending}
            onClick={() => close.mutate({ sessionId })}
          >
            {t("closeCheckIn")}
          </Button>
          {data.recentCheckIns.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">{t("recentCheckIns")}</p>
              <ul className="text-sm text-muted-foreground">
                {data.recentCheckIns.map((c) => (
                  <li key={c.id}>{c.name}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-muted-foreground">{t("windowClosedHint")}</p>
          <Button size="lg" disabled={open.isPending} onClick={() => open.mutate({ sessionId })}>
            {t("openCheckIn")}
          </Button>
        </>
      )}
    </main>
  );
}

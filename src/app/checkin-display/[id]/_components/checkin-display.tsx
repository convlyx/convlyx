"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { QrCode as QrCodeIcon, CheckCircle, Users, ChevronLeft } from "lucide-react";
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
    // Encode the home URL directly so a native-camera scan lands on the painel
    // with no /checkin redirect hop (faster cold open). The in-app scanner and
    // the /checkin deep-link route both still understand the token.
    const url = `${window.location.protocol}//${window.location.host}/?checkin=${sessionId}&t=${data.token}`;
    QRCode.toCanvas(canvasRef.current, url, { width: 320, margin: 1 }).catch(() => {});
  }, [data?.token, data?.checkInOpen, sessionId]);

  return (
    <main className="flex min-h-screen flex-col">
      <div className="p-4" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("back")}
        </Link>
      </div>

      {!data?.checkInOpen ? (
        // Closed — a clean centered card, not a bare line of text.
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-md space-y-5 rounded-3xl border bg-card p-8 text-center card-shadow">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <QrCodeIcon className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-bold">{data?.title ?? t("displayTitle")}</h1>
              <p className="text-sm text-muted-foreground">{t("openHint")}</p>
            </div>
            <Button
              size="lg"
              className="w-full"
              disabled={open.isPending}
              onClick={() => open.mutate({ sessionId })}
            >
              {t("openCheckIn")}
            </Button>
          </div>
        </div>
      ) : (
        // Open — QR and the live "Marcações recentes" panel side by side.
        <div className="flex-1 p-6">
          <div className="mx-auto max-w-5xl space-y-6">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-2xl font-bold">{data.title}</h1>
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-base font-bold text-primary">
                <Users className="h-4 w-4" />
                {t("presentCount", { count: data.attendedCount, capacity: data.capacity })}
              </span>
            </header>

            <div className="grid items-start gap-6 lg:grid-cols-2">
              {/* QR */}
              <div className="flex flex-col items-center gap-4 rounded-3xl border bg-card p-6 card-shadow">
                <div className="rounded-2xl border bg-white p-4">
                  <canvas ref={canvasRef} role="img" aria-label={t("scanToCheckIn")} />
                </div>
                <p className="text-center text-sm text-muted-foreground">{t("scanToCheckIn")}</p>
              </div>

              {/* Live check-ins */}
              <div className="flex flex-col rounded-3xl border bg-card p-6 card-shadow">
                <p className="mb-3 text-sm font-semibold text-muted-foreground">
                  {t("recentCheckIns")}
                </p>
                {data.recentCheckIns.length > 0 ? (
                  <ul className="space-y-2">
                    {data.recentCheckIns.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-sm font-medium"
                      >
                        <CheckCircle className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                        <span className="truncate">{c.name}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("noCheckInsYet")}</p>
                )}
              </div>
            </div>

            <div className="flex justify-center">
              <Button
                size="lg"
                variant="outline"
                disabled={close.isPending}
                onClick={() => close.mutate({ sessionId })}
              >
                {t("closeCheckIn")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

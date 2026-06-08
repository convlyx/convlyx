"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { QrCode, CheckCircle, ChevronRight, CameraOff } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** Extract { sessionId, token } from a scanned check-in URL, or null. */
function parseCheckInUrl(text: string): { sessionId: string; token: string } | null {
  try {
    const url = new URL(text);
    const match = url.pathname.match(/\/checkin\/([0-9a-fA-F-]{36})$/);
    const token = url.searchParams.get("t");
    if (!match || !token) return null;
    return { sessionId: match[1], token };
  } catch {
    return null;
  }
}

/**
 * In-app QR scanner for students. Opens the camera inside the app (works in the
 * installed PWA on iOS/Android — secure context required, which prod/preview
 * are) and checks in within the current session, so there's no browser hop or
 * re-login. The zxing decoder is dynamically imported so it stays out of the
 * route bundle until the student opens the scanner.
 */
export function CheckInScanner() {
  const t = useTranslations("checkin");
  const tRoot = useTranslations();
  const [open, setOpen] = useState(false);
  const [scanNonce, setScanNonce] = useState(0);
  const [cameraError, setCameraError] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const handledRef = useRef(false);
  const checkIn = trpc.enrollment.checkIn.useMutation();

  // Scan while the dialog is open and we haven't resolved a check-in yet.
  const scanning = open && !checkIn.isSuccess && !checkIn.isError && !cameraError;

  useEffect(() => {
    if (!scanning) return;
    let controls: { stop: () => void } | null = null;
    let cancelled = false;
    handledRef.current = false;
    setInvalid(false);

    (async () => {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const reader = new BrowserQRCodeReader();
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoRef.current!,
          (result) => {
            if (!result || handledRef.current) return;
            const parsed = parseCheckInUrl(result.getText());
            if (!parsed) {
              setInvalid(true);
              return;
            }
            handledRef.current = true;
            controls?.stop();
            checkIn.mutate(parsed);
          },
        );
        if (cancelled) controls.stop();
      } catch {
        setCameraError(true);
      }
    })();

    return () => {
      cancelled = true;
      controls?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning, scanNonce]);

  function reset() {
    checkIn.reset();
    setInvalid(false);
    setCameraError(false);
  }
  function restart() {
    reset();
    setScanNonce((n) => n + 1);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left card-shadow transition-all hover:card-shadow-hover"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <QrCode className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t("scanCardTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("scanCardSubtitle")}</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) setOpen(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("scannerTitle")}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {checkIn.isSuccess ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CheckCircle className="h-14 w-14 text-emerald-500" />
                <p className="text-lg font-bold">{t("marked")}</p>
                {checkIn.data.alreadyMarked && (
                  <p className="text-sm text-muted-foreground">{t("alreadyMarked")}</p>
                )}
                <p className="font-medium">{checkIn.data.title}</p>
                <Button className="mt-2 w-full" onClick={() => setOpen(false)}>
                  {t("close")}
                </Button>
              </div>
            ) : checkIn.isError ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CameraOff className="h-12 w-12 text-destructive" />
                <p className="text-sm font-medium text-destructive">
                  {tRoot.has(checkIn.error.message as never)
                    ? tRoot(checkIn.error.message as never)
                    : tRoot("errors.unexpected")}
                </p>
                <Button className="mt-2 w-full" onClick={restart}>
                  {t("tryAgain")}
                </Button>
              </div>
            ) : cameraError ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CameraOff className="h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t("cameraError")}</p>
                <Button variant="outline" className="mt-2 w-full" onClick={restart}>
                  {t("tryAgain")}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-2xl border bg-black">
                  <video
                    ref={videoRef}
                    className="aspect-square w-full object-cover"
                    autoPlay
                    playsInline
                    muted
                  />
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  {invalid ? t("scanInvalid") : t("scanHint")}
                </p>
              </div>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}

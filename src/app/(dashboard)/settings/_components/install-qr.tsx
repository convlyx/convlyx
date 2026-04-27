"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { Download, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InstallQR({ subdomain, schoolName }: { subdomain: string; schoolName: string }) {
  const t = useTranslations("settings");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [installUrl, setInstallUrl] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Always use current host — works for both localhost subdomains (e.g. demo.localhost:3000)
    // and production subdomains (e.g. demo.convlyx.com).
    const url = `${window.location.protocol}//${window.location.host}/install`;
    setInstallUrl(url);
  }, [subdomain]);

  useEffect(() => {
    if (!installUrl || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, installUrl, {
      width: 240,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    }).catch(() => {});
  }, [installUrl]);

  function downloadQR() {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `convlyx-install-${subdomain}.png`;
    link.click();
  }

  return (
    <section className="rounded-xl border bg-card p-5 card-shadow space-y-4">
      <div className="flex items-center gap-2">
        <QrCode className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">{t("installQR")}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t("installQRDescription")}</p>
      <div className="flex flex-col sm:flex-row items-start gap-4">
        <div className="rounded-lg border bg-white p-3">
          <canvas ref={canvasRef} />
        </div>
        <div className="flex-1 space-y-2">
          <p className="text-xs text-muted-foreground break-all">{installUrl}</p>
          <p className="text-sm">{schoolName}</p>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadQR}>
            <Download className="h-3.5 w-3.5" />
            {t("downloadQR")}
          </Button>
        </div>
      </div>
    </section>
  );
}

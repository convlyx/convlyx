"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Smartphone, Share, PlusSquare, Check, Download } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

type Platform = "ios" | "android" | "desktop" | "unknown";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallView({ schoolName }: { schoolName: string | null }) {
  const t = useTranslations("install");
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [isStandalone, setIsStandalone] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) setPlatform("ios");
    else if (/android/.test(ua)) setPlatform("android");
    else setPlatform("desktop");

    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallPrompt(null);
    }
  }

  if (isStandalone) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Check className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold">{t("alreadyInstalled")}</h1>
          <p className="text-sm text-muted-foreground">{t("alreadyInstalledDescription")}</p>
          <a href="/" className={buttonVariants({ variant: "default" })}>{t("openApp")}</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-xl mx-auto">
      <div className="text-center space-y-3 mb-8">
        <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <Smartphone className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        {schoolName && <p className="text-sm font-medium">{schoolName}</p>}
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {platform === "android" && installPrompt && (
        <section className="rounded-xl border bg-card p-5 card-shadow space-y-3 mb-6">
          <h2 className="text-lg font-semibold">{t("androidNative")}</h2>
          <p className="text-sm text-muted-foreground">{t("androidNativeDescription")}</p>
          <Button onClick={handleInstall} className="gap-2 w-full">
            <Download className="h-4 w-4" />
            {t("installButton")}
          </Button>
        </section>
      )}

      {platform === "ios" && (
        <section className="rounded-xl border bg-card p-5 card-shadow space-y-4">
          <h2 className="text-lg font-semibold">{t("iosTitle")}</h2>
          <ol className="space-y-3 text-sm">
            <Step number={1}>
              {t("iosStep1Before")}
              <span className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded bg-muted font-medium">
                <Share className="h-3.5 w-3.5" />
                {t("iosStep1Share")}
              </span>
              {t("iosStep1After")}
            </Step>
            <Step number={2}>
              {t("iosStep2Before")}
              <span className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded bg-muted font-medium">
                <PlusSquare className="h-3.5 w-3.5" />
                {t("iosStep2AddToHome")}
              </span>
            </Step>
            <Step number={3}>{t("iosStep3")}</Step>
          </ol>
          <p className="text-xs text-muted-foreground italic">{t("iosNote")}</p>
        </section>
      )}

      {platform === "android" && !installPrompt && (
        <section className="rounded-xl border bg-card p-5 card-shadow space-y-4">
          <h2 className="text-lg font-semibold">{t("androidTitle")}</h2>
          <ol className="space-y-3 text-sm">
            <Step number={1}>{t("androidStep1")}</Step>
            <Step number={2}>{t("androidStep2")}</Step>
            <Step number={3}>{t("androidStep3")}</Step>
          </ol>
        </section>
      )}

      {platform === "desktop" && (
        <section className="rounded-xl border bg-card p-5 card-shadow space-y-3">
          <h2 className="text-lg font-semibold">{t("desktopTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("desktopDescription")}</p>
        </section>
      )}
    </div>
  );
}

function Step({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
        {number}
      </span>
      <span className="flex-1 leading-relaxed">{children}</span>
    </li>
  );
}

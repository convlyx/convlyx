"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const DISMISS_KEY = "push-prompt-dismissed-until";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushPrompt({ userId }: { userId: string }) {
  const t = useTranslations("settings");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (!VAPID_PUBLIC_KEY) return;

    const dismissedUntil = Number(localStorage.getItem(DISMISS_KEY) ?? "0");
    if (Date.now() < dismissedUntil) return;

    if (Notification.permission === "denied") return;

    navigator.serviceWorker.register("/sw.js").then((registration) => {
      registration.pushManager.getSubscription().then((sub) => {
        if (!sub) setShow(true);
      });
    });
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DURATION_MS));
    setShow(false);
  }

  async function enable() {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, subscription: subscription.toJSON() }),
      });

      toast.success(t("pushEnabled"));
      setShow(false);
    } catch {
      toast.error(t("pushEnableError"));
    }
    setLoading(false);
  }

  if (!show) return null;

  return (
    <div className="rounded-xl border bg-card p-4 card-shadow flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Bell className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div>
          <p className="text-sm font-semibold">{t("pushPromptTitle")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t("pushPromptDescription")}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" disabled={loading} onClick={enable}>
            {loading ? t("pushPromptEnabling") : t("enablePush")}
          </Button>
          <Button size="sm" variant="ghost" onClick={dismiss}>
            {t("pushPromptLater")}
          </Button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        aria-label={t("pushPromptLater")}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

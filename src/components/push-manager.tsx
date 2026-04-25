"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

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

export function PushManager({ userId }: { userId: string }) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);

      // Register service worker
      navigator.serviceWorker.register("/sw.js").then((registration) => {
        // Check if already subscribed
        registration.pushManager.getSubscription().then((sub) => {
          setIsSubscribed(!!sub);
        });
      });
    }
  }, []);

  async function subscribe() {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });

      // Send subscription to server
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          subscription: subscription.toJSON(),
        }),
      });

      setIsSubscribed(true);
      toast.success("Notificações ativadas");
    } catch (error) {
      console.error("Push subscription failed:", error);
      toast.error("Não foi possível ativar as notificações");
    }
    setLoading(false);
  }

  async function unsubscribe() {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();

        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
      }

      setIsSubscribed(false);
      toast.success("Notificações desativadas");
    } catch {
      toast.error("Erro ao desativar notificações");
    }
    setLoading(false);
  }

  if (!isSupported || !VAPID_PUBLIC_KEY) return null;

  return (
    <Button
      variant={isSubscribed ? "outline" : "default"}
      size="sm"
      className="gap-1.5"
      disabled={loading}
      onClick={isSubscribed ? unsubscribe : subscribe}
    >
      {isSubscribed ? (
        <>
          <BellOff className="h-3.5 w-3.5" />
          {loading ? "..." : "Desativar notificações"}
        </>
      ) : (
        <>
          <Bell className="h-3.5 w-3.5" />
          {loading ? "..." : "Ativar notificações"}
        </>
      )}
    </Button>
  );
}

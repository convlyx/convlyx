"use client";

import { useEffect, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function SentryTest() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Only show on the demo subdomain
    const host = window.location.host;
    const subdomain = host.split(".")[0];
    setShow(subdomain === "demo");
  }, []);

  function captureManual() {
    Sentry.captureException(new Error("Sentry manual test"));
    toast.success("Erro enviado para o Sentry (captureException)");
  }

  function throwError() {
    setTimeout(() => {
      throw new Error("Sentry thrown test");
    }, 0);
  }

  if (!show) return null;

  return (
    <section className="rounded-xl border bg-card p-5 card-shadow space-y-3">
      <h2 className="text-lg font-semibold">Sentry · teste</h2>
      <p className="text-sm text-muted-foreground">
        Apenas visível no subdomínio <code>demo</code>. Use para verificar a integração.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={captureManual}>
          Capturar manualmente
        </Button>
        <Button variant="destructive" size="sm" onClick={throwError}>
          Lançar erro
        </Button>
      </div>
    </section>
  );
}

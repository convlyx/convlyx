"use client";

import { useTranslations } from "next-intl";
import { ArrowRight, Globe } from "lucide-react";

export default function NoTenantPage() {
  const t = useTranslations();

  return (
    <main className="flex min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/8 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />

      <div className="relative flex flex-col items-center justify-center w-full px-4">
        <div className="text-center space-y-8 max-w-lg">
          {/* Logo */}
          <div className="space-y-3">
            <img src="/favicon.png" alt="" width={72} height={72} className="mx-auto" />
            <h1 className="text-4xl font-bold">{t("common.appName")}</h1>
            <p className="text-lg text-muted-foreground">
              {t("common.appDescription")}
            </p>
          </div>

          {/* Access card */}
          <div className="rounded-2xl border bg-card p-8 card-shadow space-y-5 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold">{t("auth.noTenantTitle")}</h2>
                <p className="text-sm text-muted-foreground">{t("auth.noTenantDescription")}</p>
              </div>
            </div>

            <div className="rounded-xl bg-muted/50 border p-4">
              <p className="text-xs text-muted-foreground mb-2">{t("auth.noTenantExample")}</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-lg bg-background border px-4 py-2.5">
                  <span className="text-sm font-mono">
                    <span className="text-primary font-semibold">suaescola</span>
                    <span className="text-muted-foreground">.convlyx.com</span>
                  </span>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              {t("auth.noTenantContact")}
            </p>
          </div>

          {/* Footer */}
          <p className="text-xs text-muted-foreground">
            {t("auth.copyright", { year: new Date().getFullYear().toString() })}
          </p>
        </div>
      </div>
    </main>
  );
}

"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { LoginForm } from "./_components/login-form";

export default function LoginPage() {
  const t = useTranslations();

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-primary/3 via-transparent to-transparent" />

      <div className="relative w-full max-w-sm space-y-6 rounded-xl border bg-card p-6 card-shadow">
        <div className="text-center space-y-1">
          <img src="/favicon.png" alt="" width={56} height={56} className="mx-auto mb-3 rounded-xl shadow-md" />
          <h1 className="text-xl font-bold">{t("common.appName")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("auth.loginDescription")}
          </p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}

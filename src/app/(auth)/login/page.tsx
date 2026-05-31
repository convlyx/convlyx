"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { AuthLayout } from "../_components/auth-layout";
import { LoginForm } from "./_components/login-form";

export default function LoginPage() {
  const t = useTranslations();

  return (
    <AuthLayout>
      {/* Mobile header — brand lives in the hero, so just a concise title */}
      <div className="space-y-1.5 text-center lg:hidden">
        <h1 className="text-[1.7rem] font-bold tracking-tight">{t("auth.login")}</h1>
        <p className="text-[0.95rem] text-muted-foreground">{t("auth.enterCredentials")}</p>
      </div>

      {/* Desktop header */}
      <div className="hidden lg:block space-y-2">
        <h1 className="text-2xl font-bold">{t("auth.loginDescription")}</h1>
        <p className="text-sm text-muted-foreground">{t("auth.enterCredentials")}</p>
      </div>

      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}

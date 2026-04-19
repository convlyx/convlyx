"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { AuthLayout } from "../_components/auth-layout";
import { LoginForm } from "./_components/login-form";

export default function LoginPage() {
  const t = useTranslations();

  return (
    <AuthLayout>
      {/* Mobile header */}
      <div className="text-center space-y-1 lg:hidden">
        <img src="/favicon.png" alt="" width={56} height={56} className="mx-auto mb-3" />
        <h1 className="text-xl font-bold">{t("common.appName")}</h1>
      </div>

      {/* Desktop header */}
      <div className="hidden lg:block space-y-2">
        <h1 className="text-2xl font-bold">{t("auth.loginDescription")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("auth.enterCredentials")}
        </p>
      </div>

      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}

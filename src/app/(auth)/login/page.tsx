"use client";

import { Suspense, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AuthLayout } from "../_components/auth-layout";
import { LoginForm } from "./_components/login-form";

export default function LoginPage() {
  const t = useTranslations();
  const [tenantName, setTenantName] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tenant")
      .then((r) => r.json())
      .then((data) => {
        if (data.name) {
          setTenantName(data.name);
          document.title = `${data.name} | Convlyx`;
        }
      })
      .catch(() => {});
  }, []);

  return (
    <AuthLayout tenantName={tenantName}>
      {/* Mobile header */}
      <div className="text-center space-y-1 lg:hidden">
        <img src="/favicon.png" alt="" width={56} height={56} className="mx-auto mb-3" />
        <h1 className="text-xl font-bold">{tenantName ?? t("common.appName")}</h1>
        {tenantName && (
          <p className="text-xs text-muted-foreground">{t("auth.poweredBy")} Convlyx</p>
        )}
      </div>

      {/* Desktop header */}
      <div className="hidden lg:block space-y-2">
        {tenantName ? (
          <>
            <h1 className="text-2xl font-bold">{tenantName}</h1>
            <p className="text-sm text-muted-foreground">{t("auth.loginDescription")}</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">{t("auth.loginDescription")}</h1>
            <p className="text-sm text-muted-foreground">{t("auth.enterCredentials")}</p>
          </>
        )}
      </div>

      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}

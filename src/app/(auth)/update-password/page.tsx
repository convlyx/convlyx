"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AuthLayout } from "../_components/auth-layout";
import { UpdatePasswordForm } from "./_components/update-password-form";

export default function UpdatePasswordPage() {
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
      <div className="text-center space-y-1 lg:hidden">
        <img src="/favicon.png" alt="" width={56} height={56} className="mx-auto mb-3" />
      </div>

      <div className="space-y-2 lg:text-left text-center">
        <h1 className="text-xl lg:text-2xl font-bold">{t("auth.newPassword")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("auth.newPasswordDescription")}
        </p>
      </div>

      <UpdatePasswordForm />
    </AuthLayout>
  );
}

"use client";

import { useTranslations } from "next-intl";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations();

  return (
    <main className="flex min-h-screen">
      {/* Left — branded panel (desktop) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-emerald-700 text-primary-foreground">
        {/* Decorative shapes */}
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute top-1/3 -right-20 h-64 w-64 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 left-1/4 h-80 w-80 rounded-full bg-white/3" />
        <div className="absolute top-1/2 left-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-3xl" />

        <div className="relative flex flex-col justify-between p-12 w-full">
          {/* Top — logo */}
          <div className="flex items-center gap-3">
            <img src="/favicon.png" alt="" width={40} height={40} className="brightness-0 invert opacity-90" />
            <span className="text-xl font-bold">{t("common.appName")}</span>
          </div>

          {/* Center — welcome message */}
          <div className="space-y-4 max-w-md">
            <h2 className="text-4xl font-bold leading-tight">
              {t("auth.welcomeBack")}
            </h2>
            <p className="text-lg opacity-80">
              {t("auth.welcomeMessage")}
            </p>
          </div>

          {/* Bottom — copyright */}
          <p className="text-xs opacity-50">
            {t("auth.copyright", { year: new Date().getFullYear().toString() })}
          </p>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center bg-background relative overflow-hidden px-4">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent lg:hidden" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-primary/3 via-transparent to-transparent lg:hidden" />

        <div className="relative w-full max-w-sm space-y-6">
          {children}
          <p className="text-center text-xs text-muted-foreground lg:hidden">
            © {new Date().getFullYear()} Convlyx
          </p>
        </div>
      </div>
    </main>
  );
}

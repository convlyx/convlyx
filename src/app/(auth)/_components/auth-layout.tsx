"use client";

import { useTranslations } from "next-intl";
import { CurvedHeader } from "@/components/curved-header";

/**
 * Layout for all auth pages (login, reset-password, update-password).
 *
 * Desktop (≥lg): unchanged split-screen — branded emerald panel on the left,
 * form column on the right against the app background.
 *
 * Mobile (<lg): a curved emerald hero (brand mark + greeting) that swoops into
 * the form area via the shared `CurvedHeader`. The hero's top padding uses
 * `env(safe-area-inset-top)` so the brand never sits under a notch /
 * punch-hole / Dynamic Island, regardless of camera position. The form uses
 * the default shared inputs/buttons so it matches the rest of the app.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations();

  return (
    <main className="flex min-h-dvh flex-col lg:flex-row">
      {/* Left — branded panel (desktop only, unchanged) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-emerald-700 text-primary-foreground">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute top-1/3 -right-20 h-64 w-64 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 left-1/4 h-80 w-80 rounded-full bg-white/3" />
        <div className="absolute top-1/2 left-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-3xl" />

        <div className="relative flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <img src="/favicon.png" alt="" width={40} height={40} className="brightness-0 invert opacity-90" />
            <span className="text-xl font-bold">{t("common.appName")}</span>
          </div>

          <div className="space-y-4 max-w-md">
            <p className="text-4xl font-bold leading-tight">{t("auth.welcomeBack")}</p>
            <p className="text-lg opacity-80">{t("auth.welcomeMessage")}</p>
          </div>

          <p className="text-xs opacity-50">
            {t("auth.copyright", { year: new Date().getFullYear().toString() })}
          </p>
        </div>
      </div>

      {/* Curved emerald hero (mobile only) — uses the shared CurvedHeader */}
      <CurvedHeader
        className="flex flex-1 flex-col items-center justify-center lg:hidden"
        style={{ paddingTop: "max(2rem, env(safe-area-inset-top))" }}
      >
        <div aria-hidden className="absolute -top-20 -left-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
          <div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.10]" />
        </div>

        <div className="relative flex flex-col items-center gap-3 px-6 pb-12 text-center">
          <div className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-white/10 ring-1 ring-inset ring-white/25 backdrop-blur-sm">
            <img src="/favicon.png" alt="" width={36} height={36} className="brightness-0 invert opacity-95" />
          </div>
          <span className="text-2xl font-bold tracking-tight">{t("common.appName")}</span>
          <p className="text-base text-primary-foreground/75">{t("auth.welcomeBack")}</p>
        </div>
      </CurvedHeader>

      {/* Form column — desktop right half, mobile below the hero (top-aligned
          under the curve so the white area isn't oversized). The -mt-px tucks
          it 1px under the hero to avoid a sub-pixel seam at the wave. */}
      <div className="-mt-px flex w-full flex-col items-center justify-start bg-background px-6 pb-12 pt-9 lg:mt-0 lg:w-1/2 lg:flex-none lg:justify-center lg:px-4 lg:py-0">
        <div className="w-full max-w-sm space-y-7">{children}</div>
      </div>
    </main>
  );
}

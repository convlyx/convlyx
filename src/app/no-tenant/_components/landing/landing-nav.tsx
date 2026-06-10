"use client";

import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingNav({ onRequestDemo }: { onRequestDemo: () => void }) {
  const t = useTranslations();

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <nav className="fixed top-0 right-0 left-0 z-50 px-4 pt-3 sm:px-6 sm:pt-4">
      <div className="mx-auto flex max-w-5xl items-center justify-between rounded-full border border-[var(--landing-forest)]/12 bg-white/95 py-2 pr-2 pl-4 shadow-[0_8px_30px_rgba(16,80,40,0.10)] sm:pl-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-[var(--landing-green)] to-[var(--landing-forest)] shadow-sm shadow-[var(--landing-forest)]/25">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/favicon.png"
              alt="Convlyx"
              width={20}
              height={20}
              className="brightness-0 invert"
            />
          </div>
          <span className="text-base font-extrabold tracking-tight text-[var(--landing-ink)]">
            {t("common.appName")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => scrollTo("features")}
            className="hidden cursor-pointer rounded-full px-3.5 py-2 text-sm font-semibold text-[var(--landing-muted)] transition-colors hover:bg-[var(--landing-green)]/8 hover:text-[var(--landing-forest)] sm:block"
          >
            {t("landing.seeFeatures")}
          </button>
          <button
            type="button"
            onClick={() => scrollTo("security")}
            className="hidden cursor-pointer rounded-full px-3.5 py-2 text-sm font-semibold text-[var(--landing-muted)] transition-colors hover:bg-[var(--landing-green)]/8 hover:text-[var(--landing-forest)] md:block"
          >
            {t("landing.navSecurity")}
          </button>
          <button
            type="button"
            onClick={() => scrollTo("faq")}
            className="hidden cursor-pointer rounded-full px-3.5 py-2 text-sm font-semibold text-[var(--landing-muted)] transition-colors hover:bg-[var(--landing-green)]/8 hover:text-[var(--landing-forest)] md:block"
          >
            {t("landing.navFaq")}
          </button>
          <Button
            onClick={onRequestDemo}
            className="ml-1 cursor-pointer gap-1.5 rounded-full bg-[var(--landing-forest)] text-white shadow-md shadow-[var(--landing-forest)]/30 hover:bg-[var(--landing-green)]"
          >
            <span className="hidden sm:inline">{t("landing.requestDemo")}</span>
            <span className="sm:hidden">{t("landing.demoCTA")}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </nav>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeviceDuo } from "./device-duo";

export function LandingHero({ onRequestDemo }: { onRequestDemo: () => void }) {
  const t = useTranslations();

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <section className="landing-hero-bg relative px-6 pt-28 pb-16 md:pt-32 md:pb-24">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center gap-12 lg:flex-row lg:gap-16">
          {/* Left text */}
          <div className="animate-in fade-in slide-in-from-bottom-3 flex-1 text-center duration-700 motion-reduce:animate-none lg:text-left">
            <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.04em] text-[var(--landing-muted)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--landing-green)] ring-4 ring-[var(--landing-green)]/15" />
              {t("landing.heroEyebrow")}
            </span>
            <h1 className="mt-4 text-4xl leading-[1.05] font-extrabold tracking-tight text-[var(--landing-ink)] md:text-5xl lg:text-6xl">
              {t("landing.heroLine")}{" "}
              <span className="font-accent font-semibold text-[var(--landing-forest)]">
                {t("landing.heroAccent")}
              </span>{" "}
              {t("landing.heroAnd")}{" "}
              <span className="landing-highlight">{t("landing.heroHighlight2")}</span>
              .
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[var(--landing-muted)] lg:mx-0">
              {t("landing.heroSubtitle")}
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Button
                onClick={onRequestDemo}
                size="lg"
                className="w-full cursor-pointer gap-2 bg-[var(--landing-green)] text-white shadow-lg shadow-[var(--landing-forest)]/25 hover:bg-[var(--landing-forest)] sm:w-auto"
              >
                {t("landing.requestDemo")}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => scrollTo("features")}
                variant="outline"
                size="lg"
                className="w-full cursor-pointer gap-2 border-[var(--landing-forest)]/25 bg-white text-[var(--landing-forest)] hover:border-[var(--landing-forest)]/40 hover:bg-white hover:text-[var(--landing-forest)] sm:w-auto"
              >
                <Sparkles className="h-4 w-4" />
                {t("landing.seeFeatures")}
              </Button>
            </div>
          </div>

          {/* Right — product devices */}
          <div className="animate-in fade-in zoom-in-95 slide-in-from-bottom-5 w-full flex-1 duration-1000 [animation-delay:150ms] [animation-fill-mode:both] motion-reduce:animate-none">
            <DeviceDuo
              laptopAlt={t("landing.heroDeviceLaptopAlt")}
              phoneAlt={t("landing.heroDevicePhoneAlt")}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

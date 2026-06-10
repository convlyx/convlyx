"use client";

import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";

export function FinalCta({ onRequestDemo }: { onRequestDemo: () => void }) {
  const t = useTranslations();
  return (
    <section id="demo" className="relative overflow-hidden py-14 md:py-20">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--landing-forest),#166534)]" />
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/8" />

      <div className="relative mx-auto max-w-6xl px-6 text-center text-white">
        <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          {t("landing.ctaTitle")}{" "}
          <span className="font-accent font-semibold text-[var(--landing-accent-soft)]">
            {t("landing.ctaTitleAccent")}
          </span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg opacity-80">{t("landing.ctaDescription")}</p>

        <div className="mt-8">
          <button
            type="button"
            onClick={onRequestDemo}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-white px-8 py-3.5 text-sm font-semibold text-[var(--landing-forest)] shadow-lg shadow-black/10 transition-all hover:scale-105 hover:bg-white/90"
          >
            {t("landing.requestDemo")}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Already a user */}
        <div className="mx-auto mt-14 max-w-md border-t border-white/15 pt-8">
          <p className="mb-3 text-sm opacity-60">{t("landing.alreadyUser")}</p>
          <div className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-5 py-2.5">
            <span className="font-mono text-sm">
              <span className="font-semibold">{t("landing.yourSchool")}</span>
              <span className="opacity-60">.convlyx.com</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

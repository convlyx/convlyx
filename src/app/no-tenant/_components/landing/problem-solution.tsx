"use client";

import { useTranslations } from "next-intl";
import { X, Check, TrafficCone } from "lucide-react";
import { Eyebrow, SectionHeading, Reveal, SectionDecor } from "./_primitives";

export function ProblemSolution() {
  const t = useTranslations();
  const before = t("landing.problemBeforeItems").split("|");
  const after = t("landing.problemAfterItems").split("|");

  return (
    <section className="relative overflow-hidden py-14 md:py-20">
      <SectionDecor flip />
      <div className="relative mx-auto max-w-5xl px-6">
        <SectionHeading
          eyebrow={<Eyebrow>{t("landing.problemKicker")}</Eyebrow>}
          title={t("landing.problemTitle")}
          accent={t("landing.problemTitleAccent")}
          subtitle={t("landing.problemBody")}
          icon={TrafficCone}
        />
        <Reveal className="mt-10 grid gap-5 md:grid-cols-2">
          {/* Before — pastel red, header strip */}
          <div className="overflow-hidden rounded-2xl border border-red-100 bg-white shadow-[0_12px_30px_rgba(16,80,40,0.08)]">
            <div className="flex items-center gap-2 bg-red-100 px-5 py-3 text-sm font-bold tracking-wide text-red-400 uppercase">
              <X className="h-4 w-4" />
              {t("landing.problemBefore")}
            </div>
            <ul className="space-y-1 p-5">
              {before.map((item) => (
                <li key={item} className="flex items-center gap-3 py-1.5 text-[var(--landing-muted)]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-50">
                    <X className="h-3 w-3 text-red-400" />
                  </span>
                  <span className="text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          {/* After — elevated, green border + header */}
          <div className="overflow-hidden rounded-2xl border-2 border-[var(--landing-green)] bg-white shadow-[0_16px_40px_rgba(16,80,40,0.14)]">
            <div className="flex items-center gap-2 bg-[var(--landing-green)] px-5 py-3 text-sm font-bold tracking-wide text-white uppercase">
              <Check className="h-4 w-4" />
              {t("landing.problemAfter")}
            </div>
            <ul className="space-y-1 p-5">
              {after.map((item) => (
                <li key={item} className="flex items-center gap-3 py-1.5 text-[var(--landing-ink)]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--landing-green)]/15">
                    <Check className="h-3 w-3 text-[var(--landing-forest)]" />
                  </span>
                  <span className="text-sm leading-relaxed font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

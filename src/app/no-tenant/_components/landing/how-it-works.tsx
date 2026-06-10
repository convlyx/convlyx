"use client";

import { useTranslations } from "next-intl";
import { Eyebrow, SectionHeading, Reveal } from "./_primitives";

export function HowItWorks() {
  const t = useTranslations();
  return (
    <section className="py-14 md:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow={<Eyebrow>{t("landing.threeSteps")}</Eyebrow>}
          title={t("landing.howItWorksTitle")}
        />
        <Reveal className="relative grid gap-6 md:grid-cols-3">
          {/* Connecting line */}
          <div className="absolute top-10 right-[20%] left-[20%] hidden h-0.5 bg-gradient-to-r from-[var(--landing-green)]/0 via-[var(--landing-green)]/30 to-[var(--landing-green)]/0 md:block" />
          <Step number={1} title={t("landing.step1Title")} description={t("landing.step1Desc")} />
          <Step number={2} title={t("landing.step2Title")} description={t("landing.step2Desc")} />
          <Step number={3} title={t("landing.step3Title")} description={t("landing.step3Desc")} />
        </Reveal>
      </div>
    </section>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="relative space-y-4 rounded-2xl border border-[var(--landing-forest)]/10 bg-white p-8 text-center shadow-lg shadow-[var(--landing-forest)]/5">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--landing-green)] to-[var(--landing-forest)] text-lg font-bold text-white shadow-lg shadow-[var(--landing-forest)]/25 ring-4 ring-[var(--landing-green)]/10">
        {number}
      </div>
      <h3 className="text-lg font-semibold text-[var(--landing-ink)]">{title}</h3>
      <p className="text-sm leading-relaxed text-[var(--landing-muted)]">{description}</p>
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { ChevronRight, HelpCircle, Signpost } from "lucide-react";
import { Eyebrow, SectionHeading, SectionDecor } from "./_primitives";

export function FaqSection() {
  const t = useTranslations();
  return (
    <section id="faq" className="relative overflow-hidden py-14 md:py-20">
      <SectionDecor flip />
      <div className="relative mx-auto max-w-3xl px-6">
        <SectionHeading
          eyebrow={
            <Eyebrow>
              <HelpCircle className="h-3.5 w-3.5" />
              {t("landing.faqKicker")}
            </Eyebrow>
          }
          title={t("landing.faqTitle")}
          icon={Signpost}
        />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <FaqItem
              key={n}
              question={t(`landing.faqQ${n}` as never)}
              answer={t(`landing.faqA${n}` as never)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group rounded-xl border border-[var(--landing-forest)]/10 bg-white p-5 shadow-sm transition-all hover:border-[var(--landing-forest)]/20 hover:shadow-md">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
        <h3 className="text-base font-semibold text-[var(--landing-ink)]">{question}</h3>
        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--landing-muted)] transition-transform group-open:rotate-90" />
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-[var(--landing-muted)]">{answer}</p>
    </details>
  );
}

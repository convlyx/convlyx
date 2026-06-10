"use client";

import { useTranslations } from "next-intl";
import { ShieldCheck, Database, MessageCircle } from "lucide-react";
import { Reveal } from "./_primitives";

export function TrustStrip() {
  const t = useTranslations();
  const signals = [
    { icon: ShieldCheck, label: t("landing.trustRgpd") },
    { icon: Database, label: t("landing.trustIsolated") },
    { icon: MessageCircle, label: t("landing.trustSupport") },
  ];

  return (
    <section className="py-10 md:py-12">
      <Reveal className="mx-auto max-w-5xl px-6 text-center">
        <p className="text-sm font-medium tracking-wide text-[var(--landing-muted)]">
          {t("landing.trustLead")}
        </p>
        <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {signals.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--landing-ink)]"
            >
              <Icon className="h-4 w-4 text-[var(--landing-forest)]" />
              {label}
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}

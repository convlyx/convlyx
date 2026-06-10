"use client";

import { useTranslations } from "next-intl";
import { Shield, Users, BarChart3, Globe } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function SecuritySection() {
  const t = useTranslations();
  return (
    <section id="security" className="relative overflow-hidden py-16 md:py-24">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--landing-forest),#166534)]" />
      {/* Dot-grid texture */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-white/8" />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center gap-12 lg:flex-row">
          <div className="flex-1 space-y-6 text-white">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-100">
              <Shield className="h-3.5 w-3.5" />
              {t("landing.securityBadge")}
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">
              {t("landing.multiTenantTitle")}{" "}
              <span className="font-accent font-semibold text-[var(--landing-accent-soft)]">
                {t("landing.multiTenantTitleAccent")}
              </span>
            </h2>
            <p className="text-lg leading-relaxed text-white/80">{t("landing.multiTenantDesc")}</p>
            <div className="flex items-center gap-3 pt-2">
              <Globe className="h-5 w-5 shrink-0 text-white" />
              <div className="rounded-lg border border-white/20 bg-white/10 px-4 py-2.5">
                <span className="font-mono text-sm">
                  <span className="font-semibold text-white">{t("landing.yourSchool")}</span>
                  <span className="text-white/60">.convlyx.com</span>
                </span>
              </div>
            </div>
          </div>
          <div className="w-full max-w-md flex-1">
            <div className="space-y-3">
              <TrustCard
                icon={Shield}
                title={t("landing.isolationTitle")}
                description={t("landing.isolationDesc")}
                gradient="from-emerald-300/30 to-[var(--landing-green)]/20"
              />
              <TrustCard
                icon={Users}
                title={t("landing.rolesTitle")}
                description={t("landing.rolesDesc")}
                gradient="from-[var(--landing-accent-soft)]/40 to-[var(--landing-accent)]/25"
              />
              <TrustCard
                icon={BarChart3}
                title={t("landing.dataTitle")}
                description={t("landing.dataDesc")}
                gradient="from-emerald-300/30 to-[var(--landing-green)]/20"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustCard({
  icon: Icon,
  title,
  description,
  gradient,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-white/15 bg-white/10 p-4 transition-colors hover:border-white/25 hover:bg-white/[0.13]">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} ring-1 ring-white/20`}
      >
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-white/70">{description}</p>
      </div>
    </div>
  );
}

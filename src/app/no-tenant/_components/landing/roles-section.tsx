"use client";

import { useTranslations } from "next-intl";
import { Briefcase, BarChart3, UserCog, GraduationCap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Eyebrow, SectionHeading, Reveal } from "./_primitives";

export function RolesSection() {
  const t = useTranslations();
  const roles: { icon: LucideIcon; title: string; desc: string }[] = [
    {
      icon: Briefcase,
      title: t("landing.roleSecretaryTitle"),
      desc: t("landing.roleSecretaryDesc"),
    },
    {
      icon: BarChart3,
      title: t("landing.roleDirectionTitle"),
      desc: t("landing.roleDirectionDesc"),
    },
    {
      icon: UserCog,
      title: t("landing.roleInstructorTitle"),
      desc: t("landing.roleInstructorDesc"),
    },
    {
      icon: GraduationCap,
      title: t("landing.roleStudentTitle"),
      desc: t("landing.roleStudentDesc"),
    },
  ];

  return (
    <section className="py-14 md:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow={<Eyebrow>{t("landing.rolesKicker")}</Eyebrow>}
          title={t("landing.rolesSectionTitle")}
          accent={t("landing.rolesSectionTitleAccent")}
        />
        <Reveal className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {roles.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-[var(--landing-forest)]/10 bg-white p-6 shadow-sm shadow-[var(--landing-forest)]/5 transition-all hover:-translate-y-1 hover:border-[var(--landing-forest)]/20 hover:shadow-lg hover:shadow-[var(--landing-forest)]/10"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--landing-green)]/10">
                <Icon className="h-5 w-5 text-[var(--landing-forest)]" />
              </div>
              <h3 className="font-semibold text-[var(--landing-ink)]">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--landing-muted)]">{desc}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

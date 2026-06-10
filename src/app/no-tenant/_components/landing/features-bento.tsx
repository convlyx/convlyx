"use client";

import { useTranslations } from "next-intl";
import {
  CalendarDays,
  Users,
  BookOpen,
  Bell,
  Smartphone,
  BarChart3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Eyebrow, SectionHeading, Reveal } from "./_primitives";

export function FeaturesBento() {
  const t = useTranslations();

  return (
    <section id="features" className="py-14 md:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow={<Eyebrow>{t("landing.featuresKicker")}</Eyebrow>}
          title={t("landing.featuresTitle")}
          accent={t("landing.featuresTitleAccent")}
          subtitle={t("landing.featuresDescription")}
        />

        <Reveal className="grid grid-cols-2 gap-4 md:grid-cols-6 md:[grid-auto-rows:minmax(0,1fr)]">
          {/* Calendar — large tile with calendar UI (cols 1-3, rows 1-2) */}
          <FeatureTile
            icon={CalendarDays}
            title={t("landing.featureCalendar")}
            description={t("landing.featureCalendarDesc")}
            className="col-span-2 bg-[linear-gradient(160deg,#ffffff,#f1f8f1)] md:col-span-3 md:row-span-2"
            large
          >
            <div className="mt-5 flex flex-1 flex-col">
              <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-[var(--landing-muted)]">
                {["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => (
                  <span key={i}>{d}</span>
                ))}
              </div>
              <div className="grid min-h-[150px] flex-1 grid-cols-7 grid-rows-5 gap-1.5">
                {Array.from({ length: 35 }).map((_, i) => {
                  const today = i === 16;
                  const filled = [2, 4, 9, 12, 18, 23, 27, 30].includes(i);
                  return (
                    <div
                      key={i}
                      className={`rounded-md ${
                        today
                          ? "bg-[var(--landing-accent)]"
                          : filled
                            ? "bg-[var(--landing-green)]/30"
                            : "bg-[var(--landing-forest)]/6"
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </FeatureTile>

          {/* Students — wide tile with avatar stack (cols 4-6, row 1) */}
          <FeatureTile
            icon={Users}
            title={t("landing.featureStudents")}
            description={t("landing.featureStudentsDesc")}
            className="col-span-2 md:col-span-3"
          >
            <div className="mt-3 flex">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="-ml-1.5 h-7 w-7 rounded-full border-2 border-white bg-gradient-to-br from-emerald-300 to-[var(--landing-green)] first:ml-0"
                />
              ))}
              <span className="-ml-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[var(--landing-canvas)] text-[10px] font-bold text-[var(--landing-forest)]">
                +45
              </span>
            </div>
          </FeatureTile>

          {/* Classes (cols 4-6, row 2) */}
          <FeatureTile
            icon={BookOpen}
            title={t("landing.featureClasses")}
            description={t("landing.featureClassesDesc")}
            className="col-span-2 md:col-span-3"
          >
            <div className="mt-auto space-y-1.5 pt-4">
              {[
                { color: "bg-blue-400", w: "w-1/2" },
                { color: "bg-[var(--landing-green)]", w: "w-2/5" },
              ].map((row, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg bg-[var(--landing-canvas)] px-2.5 py-2"
                >
                  <span className={`h-2 w-2 rounded-full ${row.color}`} />
                  <span className={`h-1.5 rounded bg-[var(--landing-forest)]/20 ${row.w}`} />
                  <span className="ml-auto h-1.5 w-8 rounded bg-[var(--landing-forest)]/10" />
                </div>
              ))}
            </div>
          </FeatureTile>

          {/* Bottom row: Notifications / Mobile / Reports (2 cols each) */}
          <FeatureTile
            icon={Bell}
            title={t("landing.featureNotifications")}
            description={t("landing.featureNotificationsDesc")}
            className="col-span-2"
          >
            <div className="mt-auto flex items-center gap-2 pt-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--landing-green)]/10">
                <Bell className="h-4 w-4 text-[var(--landing-forest)]" />
              </div>
              <div className="flex-1 space-y-1">
                <span className="block h-1.5 w-4/5 rounded bg-[var(--landing-forest)]/20" />
                <span className="block h-1.5 w-1/2 rounded bg-[var(--landing-forest)]/10" />
              </div>
              <span className="h-4 w-4 rounded-full bg-[var(--landing-accent)] ring-2 ring-white" />
            </div>
          </FeatureTile>
          <FeatureTile
            icon={Smartphone}
            title={t("landing.featureMobile")}
            description={t("landing.featureMobileDesc")}
            className="col-span-2"
          >
            <div className="mt-auto flex items-end gap-1.5 pt-4">
              {["h-6", "h-9", "h-7"].map((h, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-md border border-[var(--landing-forest)]/10 bg-[var(--landing-canvas)] ${h}`}
                >
                  <div className="m-1 h-1.5 rounded-sm bg-[var(--landing-green)]/30" />
                </div>
              ))}
            </div>
          </FeatureTile>
          <FeatureTile
            icon={BarChart3}
            title={t("landing.featureReports")}
            description={t("landing.featureReportsDesc")}
            className="col-span-2"
          >
            <div className="mt-3 flex h-7 items-end gap-1">
              {[40, 62, 48, 80, 66, 100].map((h, i, arr) => (
                <span
                  key={i}
                  style={{ height: `${h}%` }}
                  className={`flex-1 rounded-sm ${
                    i === arr.length - 1
                      ? "bg-[var(--landing-accent)]"
                      : "bg-[var(--landing-green)]/25"
                  }`}
                />
              ))}
            </div>
          </FeatureTile>
        </Reveal>
      </div>
    </section>
  );
}

function FeatureTile({
  icon: Icon,
  title,
  description,
  className = "",
  large = false,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
  large?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`group flex flex-col rounded-2xl border border-[var(--landing-forest)]/10 bg-white p-6 shadow-sm shadow-[var(--landing-forest)]/5 transition-all hover:-translate-y-1 hover:border-[var(--landing-forest)]/20 hover:shadow-xl hover:shadow-[var(--landing-forest)]/10 ${className}`}
    >
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--landing-green)]/10 transition-transform group-hover:scale-110">
        <Icon className="h-5 w-5 text-[var(--landing-forest)]" />
      </div>
      <h3 className={`font-semibold text-[var(--landing-ink)] ${large ? "text-lg" : ""}`}>
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--landing-muted)]">{description}</p>
      {children}
    </div>
  );
}

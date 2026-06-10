"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CalendarDays,
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  GraduationCap,
  Users,
  UserCog,
  BarChart3,
  Settings,
  Smartphone,
  Tablet,
  Briefcase,
  Home,
  ChevronRight,
  X,
  ZoomIn,
  ImageIcon,
  Laptop,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Eyebrow, SectionHeading, SectionDecor } from "./_primitives";

const BO = {
  calendar: "/screenshots/bo-calendar.png",
  dashboard: "/screenshots/bo-dashboard.png",
  classes: "/screenshots/bo-classes.png",
  classDetails: "/screenshots/bo-class-details.png",
  students: "/screenshots/bo-students.png",
  studentDetail: "/screenshots/bo-student-detail.png",
  instructorDetail: "/screenshots/bo-instructor-detail.png",
  analytics: "/screenshots/bo-analytics.png",
  settings: "/screenshots/bo-settings.png",
} as const;

const APP = {
  home: "/screenshots/app-home.png",
  enrolments: "/screenshots/app-enrolments.png",
  homeInstructor: "/screenshots/app-home-instructor.png",
} as const;

type Shot = {
  src: string;
  icon: LucideIcon;
  title: string;
  description: string;
  caption: string;
};

type LightboxState = Shot & { aspect: "browser" | "phone" };

export function ProductShowcase() {
  const t = useTranslations();
  const [tab, setTab] = useState<"bo" | "app">("bo");
  const [boActive, setBoActive] = useState(0);
  const [appActive, setAppActive] = useState(0);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  const boFeatures: Shot[] = [
    { src: BO.dashboard, icon: LayoutDashboard, title: t("landing.showcaseBoDashboardLabel"), description: t("landing.showcaseBoDashboardDescription"), caption: t("landing.showcaseBoDashboardCaption") },
    { src: BO.calendar, icon: CalendarDays, title: t("landing.showcaseBoCalendarLabel"), description: t("landing.showcaseBoCalendarDescription"), caption: t("landing.showcaseBoCalendarCaption") },
    { src: BO.classes, icon: BookOpen, title: t("landing.showcaseBoClassesLabel"), description: t("landing.showcaseBoClassesDescription"), caption: t("landing.showcaseBoClassesCaption") },
    { src: BO.classDetails, icon: ClipboardList, title: t("landing.showcaseBoClassDetailsLabel"), description: t("landing.showcaseBoClassDetailsDescription"), caption: t("landing.showcaseBoClassDetailsCaption") },
    { src: BO.students, icon: GraduationCap, title: t("landing.showcaseBoStudentsLabel"), description: t("landing.showcaseBoStudentsDescription"), caption: t("landing.showcaseBoStudentsCaption") },
    { src: BO.studentDetail, icon: Users, title: t("landing.showcaseBoStudentDetailLabel"), description: t("landing.showcaseBoStudentDetailDescription"), caption: t("landing.showcaseBoStudentDetailCaption") },
    { src: BO.instructorDetail, icon: UserCog, title: t("landing.showcaseBoInstructorDetailLabel"), description: t("landing.showcaseBoInstructorDetailDescription"), caption: t("landing.showcaseBoInstructorDetailCaption") },
    { src: BO.analytics, icon: BarChart3, title: t("landing.showcaseBoAnalyticsLabel"), description: t("landing.showcaseBoAnalyticsDescription"), caption: t("landing.showcaseBoAnalyticsCaption") },
    { src: BO.settings, icon: Settings, title: t("landing.showcaseBoSettingsLabel"), description: t("landing.showcaseBoSettingsDescription"), caption: t("landing.showcaseBoSettingsCaption") },
  ];

  const appShots: Shot[] = [
    { src: APP.home, icon: Home, title: t("landing.showcaseAppHomeLabel"), description: t("landing.showcaseAppHomeDescription"), caption: t("landing.showcaseAppHomeCaption") },
    { src: APP.enrolments, icon: ClipboardList, title: t("landing.showcaseAppEnrolmentsLabel"), description: t("landing.showcaseAppEnrolmentsDescription"), caption: t("landing.showcaseAppEnrolmentsCaption") },
    { src: APP.homeInstructor, icon: Briefcase, title: t("landing.showcaseAppHomeInstructorLabel"), description: t("landing.showcaseAppHomeInstructorDescription"), caption: t("landing.showcaseAppHomeInstructorCaption") },
  ];

  const boCurrent = boFeatures[boActive];
  const appCurrent = appShots[appActive];

  return (
    <section id="showcase" className="relative overflow-hidden py-14 md:py-20">
      <SectionDecor />
      <div className="relative mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow={<Eyebrow>{t("landing.showcaseKicker")}</Eyebrow>}
          title={t("landing.showcaseTitle")}
          accent={t("landing.showcaseTitleAccent")}
          subtitle={t("landing.showcaseDescription")}
          icon={Laptop}
        />

        {/* Top toggle: Backoffice | App */}
        <div className="mb-10 flex justify-center">
          <div
            role="tablist"
            aria-label={t("landing.showcaseTitle")}
            className="inline-flex items-center gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-[var(--landing-forest)]/10"
          >
            <TopTab active={tab === "bo"} onClick={() => setTab("bo")} icon={Tablet} label={t("landing.showcaseTabBackoffice")} />
            <TopTab active={tab === "app"} onClick={() => setTab("app")} icon={Smartphone} label={t("landing.showcaseTabApp")} />
          </div>
        </div>

        {tab === "bo" ? (
          /* Backoffice — click a feature, see its print */
          <div className="grid items-start gap-6 md:grid-cols-[250px_1fr] md:gap-10">
            <div
              role="tablist"
              aria-label={t("landing.showcaseTabBackoffice")}
              className="flex gap-2 overflow-x-auto pb-2 md:flex-col md:gap-1.5 md:overflow-visible md:pb-0"
            >
              {boFeatures.map((f, i) => {
                const isActive = i === boActive;
                const Icon = f.icon;
                return (
                  <button
                    key={f.src}
                    role="tab"
                    aria-selected={isActive}
                    type="button"
                    onClick={() => setBoActive(i)}
                    className={`inline-flex shrink-0 cursor-pointer items-center gap-2.5 rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition-colors md:w-full ${
                      isActive
                        ? "bg-white text-[var(--landing-forest)] shadow-sm ring-1 ring-[var(--landing-forest)]/10"
                        : "text-[var(--landing-muted)] hover:bg-white/60 hover:text-[var(--landing-forest)]"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                        isActive
                          ? "bg-[var(--landing-green)]/12 text-[var(--landing-forest)]"
                          : "bg-[var(--landing-forest)]/6 text-[var(--landing-muted)]"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 whitespace-nowrap md:whitespace-normal">{f.title}</span>
                    {isActive ? (
                      <ChevronRight className="hidden h-4 w-4 text-[var(--landing-forest)]/50 md:block" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mx-auto min-w-0 md:mx-0 md:max-w-[720px]">
              <button
                type="button"
                onClick={() => setLightbox({ ...boCurrent, aspect: "browser" })}
                aria-label={`${t("landing.showcaseLightboxZoom")}: ${boCurrent.title}`}
                className="group block w-full cursor-zoom-in"
              >
                <div
                  key={boCurrent.src}
                  className="animate-in fade-in relative overflow-hidden rounded-2xl border border-[var(--landing-forest)]/10 bg-white shadow-[0_18px_45px_rgba(16,80,40,0.12)] duration-300"
                >
                  <div className="relative aspect-[16/10] bg-[var(--landing-canvas)]">
                    <ScreenshotImage src={boCurrent.src} title={boCurrent.title} icon={boCurrent.icon} />
                    <ZoomHint label={t("landing.showcaseLightboxZoom")} />
                  </div>
                </div>
              </button>
              <p className="mt-4 text-sm leading-relaxed text-[var(--landing-muted)]">
                {boCurrent.description}
              </p>
            </div>
          </div>
        ) : (
          /* App — minimal phone frame + switcher (one screen at a time) */
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => setLightbox({ ...appCurrent, aspect: "phone" })}
              aria-label={`${t("landing.showcaseLightboxZoom")}: ${appCurrent.title}`}
              className="group cursor-zoom-in"
            >
              <div className="rounded-[2.1rem] border-[3px] border-[var(--landing-forest)]/15 bg-white p-1.5 shadow-[0_22px_50px_rgba(16,80,40,0.16)]">
                <div
                  key={appCurrent.src}
                  className="animate-in fade-in relative aspect-[9/19] w-[220px] overflow-hidden rounded-[1.7rem] bg-[var(--landing-canvas)] duration-300"
                >
                  <ScreenshotImage src={appCurrent.src} title={appCurrent.title} icon={appCurrent.icon} />
                  <ZoomHint label={t("landing.showcaseLightboxZoom")} />
                </div>
              </div>
            </button>

            {/* Screen switcher */}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {appShots.map((shot, i) => {
                const isActive = i === appActive;
                return (
                  <button
                    key={shot.src}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setAppActive(i)}
                    className={`cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                      isActive
                        ? "bg-[var(--landing-forest)] text-white"
                        : "bg-white text-[var(--landing-muted)] ring-1 ring-[var(--landing-forest)]/10 hover:text-[var(--landing-forest)]"
                    }`}
                  >
                    {shot.title}
                  </button>
                );
              })}
            </div>
            <p className="mt-4 max-w-md text-center text-sm leading-relaxed text-[var(--landing-muted)]">
              {appCurrent.description}
            </p>
          </div>
        )}
      </div>

      {lightbox && <Lightbox state={lightbox} onClose={() => setLightbox(null)} />}
    </section>
  );
}

function TopTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      type="button"
      onClick={onClick}
      className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
        active
          ? "bg-[var(--landing-forest)] text-white"
          : "text-[var(--landing-muted)] hover:text-[var(--landing-forest)]"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function ZoomHint({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--landing-forest)]/25 opacity-0 transition-opacity group-hover:opacity-100">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-[var(--landing-forest)] shadow-md">
        <ZoomIn className="h-3.5 w-3.5" />
        {label}
      </span>
    </div>
  );
}

/** Screenshot with placeholder fallback when the file is absent. */
function ScreenshotImage({ src, title, icon }: { src: string; title: string; icon: LucideIcon }) {
  const [hasImage, setHasImage] = useState(true);
  useEffect(() => {
    setHasImage(true);
  }, [src]);
  if (!hasImage) return <ScreenshotPlaceholder icon={icon} label={title} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={title}
      loading="lazy"
      className="absolute inset-0 h-full w-full object-cover object-top"
      onError={() => setHasImage(false)}
    />
  );
}

function Lightbox({ state, onClose }: { state: LightboxState; onClose: () => void }) {
  const t = useTranslations();
  const [hasImage, setHasImage] = useState(true);

  useEffect(() => {
    setHasImage(true);
  }, [state.src]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isPhone = state.aspect === "phone";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={state.title}
      onClick={onClose}
      className="animate-in fade-in fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 md:p-8"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative flex w-full flex-col overflow-hidden rounded-2xl bg-card shadow-2xl ${
          isPhone ? "max-w-md" : "max-w-5xl"
        } max-h-[92vh]`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("landing.showcaseLightboxClose")}
          className="absolute top-3 right-3 z-20 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-background/90 text-foreground shadow-md ring-1 ring-border transition-all hover:scale-110 hover:bg-foreground hover:text-background active:scale-95"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isPhone ? (
            <div className="flex items-center justify-center bg-[var(--landing-canvas)] p-4 md:p-6">
              {hasImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={state.src}
                  alt={state.title}
                  className="max-h-[65vh] w-auto rounded-2xl object-contain shadow-lg"
                  onError={() => setHasImage(false)}
                />
              ) : (
                <div className="relative aspect-[9/19] w-[280px] overflow-hidden rounded-2xl bg-card shadow-lg">
                  <ScreenshotPlaceholder icon={state.icon} label={state.title} />
                </div>
              )}
            </div>
          ) : (
            <div className="relative aspect-[16/10] bg-[var(--landing-canvas)]">
              {hasImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={state.src}
                  alt={state.title}
                  className="absolute inset-0 h-full w-full object-contain"
                  onError={() => setHasImage(false)}
                />
              ) : (
                <ScreenshotPlaceholder icon={state.icon} label={state.title} />
              )}
            </div>
          )}
          <div className="border-t p-6 md:p-7">
            <h3 className="pr-12 text-lg font-bold md:text-xl">{state.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
              {state.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScreenshotPlaceholder({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  const t = useTranslations();
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--landing-green)]/12 ring-1 ring-[var(--landing-forest)]/10">
        <Icon className="h-6 w-6 text-[var(--landing-forest)]" />
      </div>
      <span className="text-center text-sm font-medium text-[var(--landing-ink)]/70">{label}</span>
      <span className="inline-flex items-center gap-1.5 text-[10px] text-[var(--landing-muted)]">
        <ImageIcon className="h-3 w-3" />
        {t("landing.showcasePlaceholderPending")}
      </span>
    </div>
  );
}

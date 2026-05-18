"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { SiteFooter } from "./site-footer";
import { DemoDialog } from "./demo-dialog";
import {
  CalendarDays, Users, BookOpen, Bell, Shield, BarChart3,
  ChevronRight, ArrowRight, Smartphone, Globe, Check, HelpCircle,
  Sparkles, CalendarCheck, ShieldCheck, GraduationCap,
  ImageIcon, Home, Tablet, LayoutDashboard, UserCog, Settings,
  X, ZoomIn, Briefcase, ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

// Drop real screenshots into /public/screenshots/ with the filenames below and
// they replace the placeholder visuals automatically. Until they exist, each
// slot renders a styled placeholder with an icon + caption so the layout is
// stable for design review.
const BO_SCREENSHOTS = {
  calendar: "/screenshots/bo-calendar.png",
  calendarModal: "/screenshots/bo-calendar-modal.png",
  dashboard: "/screenshots/bo-dashboard.png",
  classes: "/screenshots/bo-classes.png",
  classDetails: "/screenshots/bo-class-details.png",
  students: "/screenshots/bo-students.png",
  studentDetail: "/screenshots/bo-student-detail.png",
  instructorDetail: "/screenshots/bo-instructor-detail.png",
  analytics: "/screenshots/bo-analytics.png",
  settings: "/screenshots/bo-settings.png",
} as const;

const APP_SCREENSHOTS = {
  home: "/screenshots/app-home.png",
  enrolments: "/screenshots/app-enrolments.png",
  homeInstructor: "/screenshots/app-home-instructor.png",
} as const;

type LightboxState = {
  src: string;
  title: string;
  description: string;
  icon: LucideIcon;
  aspect: "browser" | "phone";
};

export function LandingPage() {
  const t = useTranslations();
  const [demoOpen, setDemoOpen] = useState(false);
  const [showcaseTab, setShowcaseTab] = useState<"bo" | "app">("bo");
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/70 backdrop-blur-xl border-b border-primary/5">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-emerald-500 shadow-md shadow-primary/20">
              <img src="/favicon.png" alt="Convlyx" width={22} height={22} className="brightness-0 invert" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">{t("common.appName")}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => scrollTo("features")} className="text-sm text-muted-foreground hover:text-primary transition-colors hidden sm:block px-3 py-1.5 cursor-pointer">
              {t("landing.seeFeatures")}
            </button>
            <Button
              onClick={() => scrollTo("showcase")}
              variant="outline"
              size="sm"
              className="gap-1.5 hidden md:inline-flex border-primary/30 text-primary hover:bg-primary/5 hover:text-primary hover:border-primary/50 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {t("landing.showcaseNav")}
            </Button>
            <Button onClick={() => setDemoOpen(true)} size="sm" className="gap-1.5 shadow-md shadow-primary/20 cursor-pointer">
              <span className="hidden sm:inline">{t("landing.requestDemo")}</span>
              <span className="sm:hidden">{t("landing.demoCTA")}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero — full width gradient */}
      <section className="relative pt-24 pb-0 md:pt-28">
        {/* Background — rich green glow */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/8 via-emerald-500/3 to-background" />
        <div className="absolute top-10 right-10 w-[500px] h-[500px] rounded-full bg-primary/15 blur-[120px] -z-10" />
        <div className="absolute top-40 left-0 w-80 h-80 rounded-full bg-emerald-400/12 blur-[100px] -z-10" />
        <div className="absolute top-60 right-1/3 w-48 h-48 rounded-full bg-green-300/10 blur-[60px] -z-10" />

        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
            {/* Left text */}
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary mb-6">
                <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                {t("landing.badge")}
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08]">
                {t("landing.heroTitle")}
                <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent"> {t("landing.heroHighlight")}</span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed mx-auto lg:mx-0">
                {t("landing.heroDescription")}
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Button onClick={() => setDemoOpen(true)} size="lg" className="gap-2 w-full sm:w-auto shadow-lg shadow-primary/20 cursor-pointer">
                  {t("landing.requestDemo")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => scrollTo("showcase")}
                  variant="outline"
                  size="lg"
                  className="gap-2 w-full sm:w-auto border-primary/30 text-primary hover:bg-primary/5 hover:text-primary hover:border-primary/50 cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" />
                  {t("landing.showcaseNav")}
                </Button>
              </div>
            </div>

            {/* Right — app preview mockup */}
            <div className="flex-1 w-full max-w-lg">
              <div className="relative">
                {/* Glow behind */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-emerald-400/30 rounded-3xl blur-3xl scale-90" />
                <div className="absolute -inset-1 bg-gradient-to-br from-primary/10 to-emerald-400/10 rounded-2xl" />
                {/* Card mockup */}
                <div className="relative rounded-2xl border border-primary/10 bg-card p-5 shadow-xl shadow-primary/5 space-y-3">
                  {/* Mini header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-primary/60" />
                      <div className="h-2 w-20 rounded bg-muted" />
                    </div>
                    <div className="flex gap-1">
                      <div className="h-2 w-2 rounded-full bg-muted" />
                      <div className="h-2 w-2 rounded-full bg-muted" />
                      <div className="h-2 w-2 rounded-full bg-muted" />
                    </div>
                  </div>
                  {/* Mini stat cards */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 p-3 space-y-1">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      <p className="text-lg font-bold">12</p>
                      <p className="text-[9px] text-muted-foreground">Aulas hoje</p>
                    </div>
                    <div className="rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-3 space-y-1">
                      <Users className="h-4 w-4 text-emerald-500" />
                      <p className="text-lg font-bold">48</p>
                      <p className="text-[9px] text-muted-foreground">Alunos ativos</p>
                    </div>
                    <div className="rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 p-3 space-y-1">
                      <Check className="h-4 w-4 text-blue-500" />
                      <p className="text-lg font-bold">94%</p>
                      <p className="text-[9px] text-muted-foreground">Assiduidade</p>
                    </div>
                  </div>
                  {/* Mini class list */}
                  <div className="space-y-1.5">
                    {[
                      { color: "bg-blue-400", title: "Código da Estrada", time: "09:00", students: "14/20" },
                      { color: "bg-emerald-500", title: "Aula Prática", time: "10:30", students: "1/1" },
                      { color: "bg-blue-400", title: "Segurança Rodoviária", time: "14:00", students: "18/20" },
                      { color: "bg-emerald-500", title: "Aula Prática", time: "16:00", students: "1/2" },
                    ].map((cls, i) => (
                      <div key={i} className="flex items-center gap-2.5 rounded-lg bg-muted/50 px-3 py-2">
                        <div className={`h-2 w-2 rounded-full ${cls.color}`} />
                        <span className="text-xs font-medium flex-1">{cls.title}</span>
                        <span className="text-[10px] text-muted-foreground">{cls.time}</span>
                        <span className="text-[10px] text-muted-foreground">{cls.students}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 md:mt-14" />
      </section>

      {/* Stats bar */}
      <section className="relative py-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-emerald-600 to-primary" />
        <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 right-20 h-36 w-36 rounded-full bg-white/5" />
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Stat value="100%" label={t("landing.statDigital")} icon={Globe} />
            <Stat value="24/7" label={t("landing.statAvailable")} icon={Shield} />
            <Stat value="0" label={t("landing.statPaper")} icon={BookOpen} />
            <Stat value="∞" label={t("landing.statScalable")} icon={BarChart3} />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-14 md:py-20 relative bg-gradient-to-b from-background via-primary/[0.02] to-background">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[150px] -z-10" />
        <div className="absolute bottom-20 right-0 w-72 h-72 rounded-full bg-emerald-400/8 blur-[100px] -z-10" />

        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center max-w-xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary mb-4">
              {t("landing.seeFeatures")}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold">{t("landing.featuresTitle")}</h2>
            <p className="mt-4 text-muted-foreground text-lg">
              {t("landing.featuresDescription")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard icon={CalendarDays} title={t("landing.featureCalendar")} description={t("landing.featureCalendarDesc")} gradient="from-primary/10 to-emerald-400/10" />
            <FeatureCard icon={Users} title={t("landing.featureStudents")} description={t("landing.featureStudentsDesc")} gradient="from-blue-500/10 to-cyan-400/10" />
            <FeatureCard icon={BookOpen} title={t("landing.featureClasses")} description={t("landing.featureClassesDesc")} gradient="from-emerald-500/10 to-green-400/10" />
            <FeatureCard icon={Bell} title={t("landing.featureNotifications")} description={t("landing.featureNotificationsDesc")} gradient="from-amber-500/10 to-orange-400/10" />
            <FeatureCard icon={Smartphone} title={t("landing.featureMobile")} description={t("landing.featureMobileDesc")} gradient="from-violet-500/10 to-purple-400/10" />
            <FeatureCard icon={BarChart3} title={t("landing.featureReports")} description={t("landing.featureReportsDesc")} gradient="from-rose-500/10 to-pink-400/10" />
          </div>
        </div>
      </section>

      {/* Showcase — real screenshots of Backoffice and App */}
      <section id="showcase" className="relative py-14 md:py-20 overflow-hidden">
        <div className="absolute top-20 left-0 w-72 h-72 rounded-full bg-primary/8 blur-[120px] -z-10" />
        <div className="absolute bottom-10 right-0 w-80 h-80 rounded-full bg-emerald-400/8 blur-[120px] -z-10" />

        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary mb-4">
              <Sparkles className="h-3.5 w-3.5" />
              {t("landing.showcaseKicker")}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold">{t("landing.showcaseTitle")}</h2>
            <p className="mt-4 text-muted-foreground text-lg">
              {t("landing.showcaseDescription")}
            </p>
          </div>

          {/* Tab toggle */}
          <div className="flex justify-center mb-14 md:mb-10">
            <div
              role="tablist"
              aria-label={t("landing.showcaseTitle")}
              className="inline-flex items-center gap-1 rounded-xl border bg-card p-1 shadow-sm"
            >
              <ShowcaseTabButton
                active={showcaseTab === "bo"}
                onClick={() => setShowcaseTab("bo")}
                icon={Tablet}
                label={t("landing.showcaseTabBackoffice")}
              />
              <ShowcaseTabButton
                active={showcaseTab === "app"}
                onClick={() => setShowcaseTab("app")}
                icon={Smartphone}
                label={t("landing.showcaseTabApp")}
              />
            </div>
          </div>

          {showcaseTab === "bo" ? (
            <div className="space-y-6">
              {/* Hero: calendar with class-detail modal */}
              <BrowserFrame
                src={BO_SCREENSHOTS.calendar}
                url={t("landing.showcaseBrowserUrl")}
                path="/calendar"
                placeholderIcon={CalendarDays}
                placeholderLabel={t("landing.showcaseBoCalendarLabel")}
                caption={t("landing.showcaseBoCalendarCaption")}
                onOpen={() =>
                  setLightbox({
                    src: BO_SCREENSHOTS.calendar,
                    title: t("landing.showcaseBoCalendarLabel"),
                    description: t("landing.showcaseBoCalendarDescription"),
                    icon: CalendarDays,
                    aspect: "browser",
                  })
                }
              />
              {/* 9-up grid of feature screens */}
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <BrowserFrame
                  src={BO_SCREENSHOTS.dashboard}
                  url={t("landing.showcaseBrowserUrl")}
                  path="/"
                  placeholderIcon={LayoutDashboard}
                  placeholderLabel={t("landing.showcaseBoDashboardLabel")}
                  caption={t("landing.showcaseBoDashboardCaption")}
                  compact
                  onOpen={() =>
                    setLightbox({
                      src: BO_SCREENSHOTS.dashboard,
                      title: t("landing.showcaseBoDashboardLabel"),
                      description: t("landing.showcaseBoDashboardDescription"),
                      icon: LayoutDashboard,
                      aspect: "browser",
                    })
                  }
                />
                <BrowserFrame
                  src={BO_SCREENSHOTS.calendarModal}
                  url={t("landing.showcaseBrowserUrl")}
                  path="/calendar"
                  placeholderIcon={CalendarDays}
                  placeholderLabel={t("landing.showcaseBoCalendarModalLabel")}
                  caption={t("landing.showcaseBoCalendarModalCaption")}
                  compact
                  onOpen={() =>
                    setLightbox({
                      src: BO_SCREENSHOTS.calendarModal,
                      title: t("landing.showcaseBoCalendarModalLabel"),
                      description: t("landing.showcaseBoCalendarModalDescription"),
                      icon: CalendarDays,
                      aspect: "browser",
                    })
                  }
                />
                <BrowserFrame
                  src={BO_SCREENSHOTS.classes}
                  url={t("landing.showcaseBrowserUrl")}
                  path="/classes"
                  placeholderIcon={BookOpen}
                  placeholderLabel={t("landing.showcaseBoClassesLabel")}
                  caption={t("landing.showcaseBoClassesCaption")}
                  compact
                  onOpen={() =>
                    setLightbox({
                      src: BO_SCREENSHOTS.classes,
                      title: t("landing.showcaseBoClassesLabel"),
                      description: t("landing.showcaseBoClassesDescription"),
                      icon: BookOpen,
                      aspect: "browser",
                    })
                  }
                />
                <BrowserFrame
                  src={BO_SCREENSHOTS.classDetails}
                  url={t("landing.showcaseBrowserUrl")}
                  path="/classes/…"
                  placeholderIcon={ClipboardList}
                  placeholderLabel={t("landing.showcaseBoClassDetailsLabel")}
                  caption={t("landing.showcaseBoClassDetailsCaption")}
                  compact
                  onOpen={() =>
                    setLightbox({
                      src: BO_SCREENSHOTS.classDetails,
                      title: t("landing.showcaseBoClassDetailsLabel"),
                      description: t("landing.showcaseBoClassDetailsDescription"),
                      icon: ClipboardList,
                      aspect: "browser",
                    })
                  }
                />
                <BrowserFrame
                  src={BO_SCREENSHOTS.students}
                  url={t("landing.showcaseBrowserUrl")}
                  path="/students"
                  placeholderIcon={GraduationCap}
                  placeholderLabel={t("landing.showcaseBoStudentsLabel")}
                  caption={t("landing.showcaseBoStudentsCaption")}
                  compact
                  onOpen={() =>
                    setLightbox({
                      src: BO_SCREENSHOTS.students,
                      title: t("landing.showcaseBoStudentsLabel"),
                      description: t("landing.showcaseBoStudentsDescription"),
                      icon: GraduationCap,
                      aspect: "browser",
                    })
                  }
                />
                <BrowserFrame
                  src={BO_SCREENSHOTS.studentDetail}
                  url={t("landing.showcaseBrowserUrl")}
                  path="/students/…"
                  placeholderIcon={Users}
                  placeholderLabel={t("landing.showcaseBoStudentDetailLabel")}
                  caption={t("landing.showcaseBoStudentDetailCaption")}
                  compact
                  onOpen={() =>
                    setLightbox({
                      src: BO_SCREENSHOTS.studentDetail,
                      title: t("landing.showcaseBoStudentDetailLabel"),
                      description: t("landing.showcaseBoStudentDetailDescription"),
                      icon: Users,
                      aspect: "browser",
                    })
                  }
                />
                <BrowserFrame
                  src={BO_SCREENSHOTS.instructorDetail}
                  url={t("landing.showcaseBrowserUrl")}
                  path="/instructors/…"
                  placeholderIcon={UserCog}
                  placeholderLabel={t("landing.showcaseBoInstructorDetailLabel")}
                  caption={t("landing.showcaseBoInstructorDetailCaption")}
                  compact
                  onOpen={() =>
                    setLightbox({
                      src: BO_SCREENSHOTS.instructorDetail,
                      title: t("landing.showcaseBoInstructorDetailLabel"),
                      description: t("landing.showcaseBoInstructorDetailDescription"),
                      icon: UserCog,
                      aspect: "browser",
                    })
                  }
                />
                <BrowserFrame
                  src={BO_SCREENSHOTS.analytics}
                  url={t("landing.showcaseBrowserUrl")}
                  path="/analytics"
                  placeholderIcon={BarChart3}
                  placeholderLabel={t("landing.showcaseBoAnalyticsLabel")}
                  caption={t("landing.showcaseBoAnalyticsCaption")}
                  compact
                  onOpen={() =>
                    setLightbox({
                      src: BO_SCREENSHOTS.analytics,
                      title: t("landing.showcaseBoAnalyticsLabel"),
                      description: t("landing.showcaseBoAnalyticsDescription"),
                      icon: BarChart3,
                      aspect: "browser",
                    })
                  }
                />
                <BrowserFrame
                  src={BO_SCREENSHOTS.settings}
                  url={t("landing.showcaseBrowserUrl")}
                  path="/settings"
                  placeholderIcon={Settings}
                  placeholderLabel={t("landing.showcaseBoSettingsLabel")}
                  caption={t("landing.showcaseBoSettingsCaption")}
                  compact
                  onOpen={() =>
                    setLightbox({
                      src: BO_SCREENSHOTS.settings,
                      title: t("landing.showcaseBoSettingsLabel"),
                      description: t("landing.showcaseBoSettingsDescription"),
                      icon: Settings,
                      aspect: "browser",
                    })
                  }
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap justify-center items-end gap-6 md:gap-10 pt-10 md:pt-14">
              <PhoneFrame
                src={APP_SCREENSHOTS.home}
                placeholderIcon={Home}
                placeholderLabel={t("landing.showcaseAppHomeLabel")}
                caption={t("landing.showcaseAppHomeCaption")}
                tilt="-rotate-2"
              />
              <PhoneFrame
                src={APP_SCREENSHOTS.enrolments}
                placeholderIcon={ClipboardList}
                placeholderLabel={t("landing.showcaseAppEnrolmentsLabel")}
                caption={t("landing.showcaseAppEnrolmentsCaption")}
                featured
              />
              <PhoneFrame
                src={APP_SCREENSHOTS.homeInstructor}
                placeholderIcon={Briefcase}
                placeholderLabel={t("landing.showcaseAppHomeInstructorLabel")}
                caption={t("landing.showcaseAppHomeInstructorCaption")}
                tilt="rotate-2"
              />
            </div>
          )}
        </div>
      </section>

      {/* Why Convlyx — dark inverted band breaks the white-section run */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        {/* Brand green gradient — matches stats bar & CTA for visual coherence */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-700 via-primary to-emerald-600" />
        {/* Dot grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        {/* Decorative blur orbs */}
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-white/8" />
        <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-emerald-300/10" />
        <div className="absolute top-1/2 left-1/4 h-48 w-48 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 h-32 w-32 rounded-full bg-emerald-300/10 blur-2xl" />

        <div className="relative mx-auto max-w-5xl px-6">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-200 mb-5 backdrop-blur-sm">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
              {t("landing.whyKicker")}
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
              {t("landing.whyTitle")}
            </h2>
          </div>

          <div className="grid gap-5 md:gap-6">
            <WhyBlock
              number="01"
              icon={Sparkles}
              title={t("landing.whyP1Title")}
              body={t("landing.whyP1")}
              accent="from-primary/30 to-emerald-400/20"
              ring="ring-primary/30"
            />
            <WhyBlock
              number="02"
              icon={CalendarCheck}
              title={t("landing.whyP2Title")}
              body={t("landing.whyP2")}
              accent="from-cyan-400/30 to-blue-500/20"
              ring="ring-cyan-300/30"
            />
            <WhyBlock
              number="03"
              icon={ShieldCheck}
              title={t("landing.whyP3Title")}
              body={t("landing.whyP3")}
              accent="from-emerald-400/30 to-green-500/20"
              ring="ring-emerald-300/30"
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-14 md:py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-primary/5 to-emerald-50 dark:from-emerald-950/20 dark:via-primary/5 dark:to-emerald-950/20 -z-10" />
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-primary/10 blur-[100px] -z-10" />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-emerald-400/10 blur-[80px] -z-10" />

        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center max-w-xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary mb-4">
              {t("landing.threeSteps")}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold">{t("landing.howItWorksTitle")}</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 relative">
            {/* Connecting line */}
            <div className="absolute top-10 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0 hidden md:block" />

            <Step number={1} title={t("landing.step1Title")} description={t("landing.step1Desc")} />
            <Step number={2} title={t("landing.step2Title")} description={t("landing.step2Desc")} />
            <Step number={3} title={t("landing.step3Title")} description={t("landing.step3Desc")} />
          </div>
        </div>
      </section>

      {/* Security / multi-tenant — same brand green as stats bar / Why / CTA */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-700 via-primary to-emerald-600" />
        {/* Decorative orbs */}
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-emerald-400/10" />
        <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-white/8" />
        <div className="absolute top-1/2 right-1/4 h-40 w-40 rounded-full bg-emerald-300/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 space-y-6 text-primary-foreground">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-100 backdrop-blur-sm">
                <Shield className="h-3.5 w-3.5" />
                {t("landing.securityBadge")}
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t("landing.multiTenantTitle")}</h2>
              <p className="text-white/80 text-lg leading-relaxed">
                {t("landing.multiTenantDesc")}
              </p>
              <div className="flex items-center gap-3 pt-2">
                <Globe className="h-5 w-5 text-white shrink-0" />
                <div className="rounded-lg bg-white/10 border border-white/20 px-4 py-2.5 backdrop-blur-sm">
                  <span className="text-sm font-mono">
                    <span className="text-white font-semibold">{t("landing.yourSchool")}</span>
                    <span className="text-white/60">.convlyx.com</span>
                  </span>
                </div>
              </div>
            </div>
            <div className="flex-1 w-full max-w-md">
              <div className="space-y-3">
                <TrustCard
                  icon={Shield}
                  title={t("landing.isolationTitle")}
                  description={t("landing.isolationDesc")}
                  gradient="from-emerald-300/30 to-primary/20"
                />
                <TrustCard
                  icon={Users}
                  title={t("landing.rolesTitle")}
                  description={t("landing.rolesDesc")}
                  gradient="from-cyan-300/30 to-blue-400/20"
                />
                <TrustCard
                  icon={BarChart3}
                  title={t("landing.dataTitle")}
                  description={t("landing.dataDesc")}
                  gradient="from-emerald-300/30 to-green-400/20"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-14 md:py-20 relative">
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-emerald-400/5 blur-[100px] -z-10" />
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary mb-4">
              <HelpCircle className="h-3.5 w-3.5" />
              {t("landing.faqKicker")}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold">{t("landing.faqTitle")}</h2>
          </div>
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

      {/* CTA */}
      <section id="demo" className="py-14 md:py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-700 via-primary to-emerald-600" />
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-white/8" />
        <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-emerald-300/10" />
        <div className="absolute top-1/2 left-1/4 h-48 w-48 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 h-32 w-32 rounded-full bg-emerald-300/10 blur-2xl" />

        <div className="relative mx-auto max-w-6xl px-6 text-center text-primary-foreground">
          <h2 className="text-3xl md:text-4xl font-bold">{t("landing.ctaTitle")}</h2>
          <p className="mt-4 text-lg opacity-80 max-w-xl mx-auto">
            {t("landing.ctaDescription")}
          </p>

          <div className="mt-8">
            <button
              type="button"
              onClick={() => setDemoOpen(true)}
              className="inline-flex items-center justify-center rounded-lg bg-white text-primary px-8 py-3.5 text-sm font-semibold hover:bg-white/90 transition-all cursor-pointer gap-2 shadow-lg shadow-black/10 hover:scale-105"
            >
              {t("landing.requestDemo")}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Already a user */}
          <div className="mt-14 pt-8 border-t border-white/15 max-w-md mx-auto">
            <p className="text-sm opacity-60 mb-3">{t("landing.alreadyUser")}</p>
            <div className="inline-flex items-center gap-2 rounded-lg bg-white/10 border border-white/20 px-5 py-2.5 backdrop-blur-sm">
              <span className="text-sm font-mono">
                <span className="font-semibold">{t("landing.yourSchool")}</span>
                <span className="opacity-60">.convlyx.com</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter onRequestDemo={() => setDemoOpen(true)} />

      <DemoDialog open={demoOpen} onOpenChange={setDemoOpen} />

      {lightbox && <Lightbox state={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description, gradient }: { icon: LucideIcon; title: string; description: string; gradient: string }) {
  return (
    <div className={`group rounded-2xl border p-6 shadow-md shadow-primary/3 hover:shadow-xl hover:shadow-primary/10 transition-all hover:border-primary/20 hover:-translate-y-1 bg-gradient-to-br ${gradient} backdrop-blur-sm`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/80 dark:bg-white/10 mb-4 group-hover:scale-110 transition-transform shadow-sm">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function Stat({ value, label, icon: Icon }: { value: string; label: string; icon: LucideIcon }) {
  return (
    <div className="text-center space-y-2 rounded-xl bg-white/10 backdrop-blur-sm p-5">
      <div className="flex justify-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
          <Icon className="h-4 w-4 text-white" />
        </div>
      </div>
      <p className="text-3xl md:text-4xl font-bold text-white">{value}</p>
      <p className="text-sm text-white/70">{label}</p>
    </div>
  );
}

function Step({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="relative text-center space-y-4 rounded-2xl border bg-card/80 backdrop-blur-sm p-8 shadow-lg shadow-primary/5">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-emerald-500 text-primary-foreground font-bold text-lg shadow-lg shadow-primary/25 ring-4 ring-primary/10">
        {number}
      </div>
      <h3 className="font-semibold text-lg">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function WhyBlock({
  number,
  icon: Icon,
  title,
  body,
  accent,
  ring,
}: {
  number: string;
  icon: LucideIcon;
  title: string;
  body: string;
  accent: string;
  ring: string;
}) {
  return (
    <div className="group relative flex flex-col md:flex-row gap-5 md:gap-7 rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md p-6 md:p-8 hover:border-white/25 hover:bg-white/[0.13] transition-all">
      <div className="flex md:flex-col items-center md:items-start gap-4 md:gap-4 md:w-36 shrink-0">
        <div
          className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} ring-1 ${ring} group-hover:scale-105 transition-transform`}
        >
          <Icon className="h-6 w-6 text-white" />
        </div>
        <span className="text-4xl md:text-5xl font-bold text-white/15 leading-none tracking-tight">
          {number}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-lg md:text-xl font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm md:text-base text-white/70 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/20">
      <summary className="flex cursor-pointer items-center justify-between gap-4 list-none [&::-webkit-details-marker]:hidden">
        <h3 className="font-semibold text-base">{question}</h3>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform group-open:rotate-90" />
      </summary>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{answer}</p>
    </details>
  );
}

function ShowcaseTabButton({
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
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
        active
          ? "bg-gradient-to-br from-primary to-emerald-500 text-primary-foreground shadow-md shadow-primary/25"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function BrowserFrame({
  src,
  url,
  path,
  placeholderIcon,
  placeholderLabel,
  caption,
  compact = false,
  onOpen,
}: {
  src: string;
  url: string;
  path: string;
  placeholderIcon: LucideIcon;
  placeholderLabel: string;
  caption: string;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const t = useTranslations();
  const [hasImage, setHasImage] = useState(true);
  return (
    <figure className="group">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${t("landing.showcaseLightboxZoom")}: ${placeholderLabel}`}
        className="block w-full text-left rounded-xl border bg-card shadow-xl shadow-primary/5 overflow-hidden hover:shadow-2xl hover:shadow-primary/10 transition-shadow cursor-zoom-in"
      >
        {/* Browser chrome */}
        <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          </div>
          <div className="ml-2 flex-1 rounded-md bg-background/80 px-3 py-1 text-[10px] font-mono text-muted-foreground truncate">
            <span className="text-foreground/70">{url}</span>
            <span className="opacity-50">{path}</span>
          </div>
        </div>
        {/* Image / placeholder */}
        <div className={`relative ${compact ? "aspect-[16/10]" : "aspect-[16/10]"} bg-gradient-to-br from-primary/5 via-emerald-400/5 to-background`}>
          {hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={placeholderLabel}
              className="absolute inset-0 h-full w-full object-cover object-top"
              onError={() => setHasImage(false)}
            />
          ) : (
            <ScreenshotPlaceholder icon={placeholderIcon} label={placeholderLabel} />
          )}
          {/* Zoom hint on hover */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center bg-black/30 pointer-events-none">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 text-foreground text-xs font-medium px-3 py-1.5 shadow-md">
              <ZoomIn className="h-3.5 w-3.5" />
              {t("landing.showcaseLightboxZoom")}
            </span>
          </div>
        </div>
      </button>
      <figcaption className="mt-3 text-center text-sm text-muted-foreground">{caption}</figcaption>
    </figure>
  );
}

function PhoneFrame({
  src,
  placeholderIcon,
  placeholderLabel,
  caption,
  tilt,
  featured = false,
}: {
  src: string;
  placeholderIcon: LucideIcon;
  placeholderLabel: string;
  caption: string;
  tilt?: string;
  featured?: boolean;
}) {
  const [hasImage, setHasImage] = useState(true);
  return (
    <figure className={featured ? "scale-110" : "scale-100"}>
      <div
        className={`relative ${tilt ?? ""} rounded-[2.25rem] border-[6px] border-foreground/85 bg-foreground/85 shadow-2xl shadow-primary/10 overflow-hidden ${
          featured ? "w-56" : "w-48"
        }`}
      >
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 h-5 w-24 bg-foreground/85 rounded-b-2xl" />
        {/* Phone screen — small inner padding so the screenshot doesn't touch the bezel */}
        <div className="aspect-[9/19] bg-foreground/85 p-[3px]">
          <div className="relative h-full w-full overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-primary/8 via-emerald-400/5 to-background">
            {hasImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={placeholderLabel}
                className="absolute inset-0 h-full w-full object-cover object-top"
                onError={() => setHasImage(false)}
              />
            ) : (
              <ScreenshotPlaceholder icon={placeholderIcon} label={placeholderLabel} />
            )}
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-center text-sm text-muted-foreground max-w-[14rem] mx-auto">{caption}</figcaption>
    </figure>
  );
}

function Lightbox({
  state,
  onClose,
}: {
  state: LightboxState;
  onClose: () => void;
}) {
  const t = useTranslations();
  const [hasImage, setHasImage] = useState(true);

  // Reset image-availability check whenever the source changes
  useEffect(() => {
    setHasImage(true);
  }, [state.src]);

  // Close on Escape
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 md:p-8 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative bg-card rounded-2xl shadow-2xl w-full overflow-hidden flex flex-col ${
          isPhone ? "max-w-md" : "max-w-5xl"
        } max-h-[92vh]`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("landing.showcaseLightboxClose")}
          className="absolute top-3 right-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md hover:bg-foreground hover:text-background hover:scale-110 active:scale-95 transition-all cursor-pointer ring-1 ring-border"
        >
          <X className="h-4 w-4" />
        </button>
        {isPhone ? (
          <div className="flex items-center justify-center bg-gradient-to-br from-primary/5 via-emerald-400/5 to-muted/40 p-4 md:p-6">
            {hasImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={state.src}
                alt={state.title}
                className="h-[65vh] w-auto rounded-2xl shadow-lg object-contain"
                onError={() => setHasImage(false)}
              />
            ) : (
              <div className="relative w-[280px] aspect-[9/19] rounded-2xl bg-card shadow-lg overflow-hidden">
                <ScreenshotPlaceholder icon={state.icon} label={state.title} />
              </div>
            )}
          </div>
        ) : (
          <div className="relative aspect-[16/10] bg-gradient-to-br from-primary/5 via-emerald-400/5 to-muted/40">
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
        <div className="p-6 md:p-7 border-t">
          <h3 className="text-lg md:text-xl font-bold">{state.title}</h3>
          <p className="mt-3 text-sm md:text-base text-muted-foreground leading-relaxed">
            {state.description}
          </p>
        </div>
      </div>
    </div>
  );
}

function ScreenshotPlaceholder({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  const t = useTranslations();
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-emerald-400/20 ring-1 ring-primary/15">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <span className="text-sm font-medium text-foreground/70">{label}</span>
      <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <ImageIcon className="h-3 w-3" />
        {t("landing.showcasePlaceholderPending")}
      </span>
    </div>
  );
}

function TrustCard({ icon: Icon, title, description, gradient }: { icon: LucideIcon; title: string; description: string; gradient: string }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-md hover:border-white/25 hover:bg-white/[0.13] transition-all">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} ring-1 ring-white/20`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="font-semibold text-sm text-white">{title}</p>
        <p className="text-xs text-white/70">{description}</p>
      </div>
    </div>
  );
}

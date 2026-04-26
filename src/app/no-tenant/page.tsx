"use client";

import { useTranslations } from "next-intl";
import {
  CalendarDays, Users, BookOpen, Bell, Shield, BarChart3,
  ChevronRight, ArrowRight, Smartphone, Globe, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

export default function LandingPage() {
  const t = useTranslations();

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
              <img src="/favicon.png" alt="" width={22} height={22} className="brightness-0 invert" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">{t("common.appName")}</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => scrollTo("features")} className="text-sm text-muted-foreground hover:text-primary transition-colors hidden sm:block px-3 py-1.5">
              {t("landing.seeFeatures")}
            </button>
            <Button onClick={() => scrollTo("demo")} size="sm" className="gap-1.5 shadow-md shadow-primary/20">
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
                <Button onClick={() => scrollTo("demo")} size="lg" className="gap-2 w-full sm:w-auto shadow-lg shadow-primary/20">
                  {t("landing.requestDemo")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button onClick={() => scrollTo("features")} variant="outline" size="lg" className="gap-2 w-full sm:w-auto">
                  {t("landing.seeFeatures")}
                  <ChevronRight className="h-4 w-4" />
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

      {/* Security / multi-tenant */}
      <section className="py-14 md:py-20 relative">
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-emerald-400/8 blur-[120px] -z-10" />
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-primary/5 blur-[80px] -z-10" />

        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                <Shield className="h-3.5 w-3.5" />
                {t("landing.securityBadge")}
              </div>
              <h2 className="text-3xl md:text-4xl font-bold">{t("landing.multiTenantTitle")}</h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                {t("landing.multiTenantDesc")}
              </p>
              <div className="flex items-center gap-3 pt-2">
                <Globe className="h-5 w-5 text-primary shrink-0" />
                <div className="rounded-lg bg-muted border px-4 py-2.5">
                  <span className="text-sm font-mono">
                    <span className="text-primary font-semibold">{t("landing.yourSchool")}</span>
                    <span className="text-muted-foreground">.convlyx.com</span>
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
                  gradient="from-primary/10 to-emerald-400/10"
                />
                <TrustCard
                  icon={Users}
                  title={t("landing.rolesTitle")}
                  description={t("landing.rolesDesc")}
                  gradient="from-blue-500/10 to-cyan-400/10"
                />
                <TrustCard
                  icon={BarChart3}
                  title={t("landing.dataTitle")}
                  description={t("landing.dataDesc")}
                  gradient="from-emerald-500/10 to-green-400/10"
                />
              </div>
            </div>
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
            <a
              href="mailto:info@convlyx.com"
              className="inline-flex items-center justify-center rounded-lg bg-white text-primary px-8 py-3.5 text-sm font-semibold hover:bg-white/90 transition-all cursor-pointer gap-2 shadow-lg shadow-black/10 hover:scale-105"
            >
              {t("landing.requestDemo")}
              <ArrowRight className="h-4 w-4" />
            </a>
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

      {/* Footer */}
      <footer className="relative border-t bg-gradient-to-b from-background to-primary/3 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center gap-6">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-emerald-500 shadow-md shadow-primary/20">
                <img src="/favicon.png" alt="" width={22} height={22} className="brightness-0 invert" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">{t("common.appName")}</span>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground text-center max-w-md">
              {t("common.appDescription")}
            </p>

            {/* Links */}
            <div className="flex items-center gap-6 text-sm">
              <button onClick={() => scrollTo("features")} className="text-muted-foreground hover:text-primary transition-colors">{t("landing.seeFeatures")}</button>
              <button onClick={() => scrollTo("demo")} className="text-muted-foreground hover:text-primary transition-colors">{t("landing.requestDemo")}</button>
            </div>

            {/* Divider */}
            <div className="w-full max-w-xs h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

            {/* Copyright */}
            <p className="text-xs text-muted-foreground">
              {t("auth.copyright", { year: new Date().getFullYear().toString() })}
            </p>
          </div>
        </div>
      </footer>
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

function TrustCard({ icon: Icon, title, description, gradient }: { icon: LucideIcon; title: string; description: string; gradient: string }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-md shadow-primary/3 hover:shadow-lg hover:shadow-primary/8 transition-all hover:border-primary/10">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient}`}>
        <Icon className="h-5 w-5 text-foreground" />
      </div>
      <div>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

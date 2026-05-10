"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRight, Check, ChevronRight } from "lucide-react";
import { SiteFooter } from "./site-footer";
import { DemoDialog } from "./demo-dialog";

export type SeoLandingRelated = {
  href: string;
  title: string;
  description: string;
};

export type SeoFeature = {
  /** Pre-rendered icon element (e.g. <CalendarDays className="h-5 w-5 text-primary" />)
   *  — passed as ReactNode because component refs can't cross the server/client boundary. */
  icon: ReactNode;
  title: string;
  description: string;
  /** tailwind gradient classes — e.g. "from-primary/10 to-emerald-400/10" */
  gradient: string;
};

export type SeoDeepDive = {
  kicker: string;
  title: string;
  body: string[];
  bullets?: string[];
  mockup: ReactNode;
  /** which side the mockup sits on (alternates page rhythm). default: "right" */
  mockupPosition?: "left" | "right";
};

export function SeoLanding({
  kicker,
  title,
  highlight,
  intro,
  heroMockup,
  features,
  deepDive,
  midCta,
  related,
}: {
  kicker: string;
  title: string;
  highlight: string;
  intro: string;
  heroMockup: ReactNode;
  features: SeoFeature[];
  deepDive: SeoDeepDive;
  midCta?: { title: string; description: string };
  related?: SeoLandingRelated[];
}) {
  const [demoOpen, setDemoOpen] = useState(false);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  const mockupOnLeft = deepDive.mockupPosition === "left";

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Nav — mirrors main landing */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/70 backdrop-blur-xl border-b border-primary/5">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-emerald-500 shadow-md shadow-primary/20">
              <img src="/favicon.png" alt="" width={22} height={22} className="brightness-0 invert" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">Convlyx</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => scrollTo("features")}
              className="text-sm text-muted-foreground hover:text-primary transition-colors hidden sm:block px-3 py-1.5"
            >
              Funcionalidades
            </button>
            <button
              onClick={() => scrollTo("saber-mais")}
              className="text-sm text-muted-foreground hover:text-primary transition-colors hidden md:block px-3 py-1.5"
            >
              Saber mais
            </button>
            <button
              onClick={() => setDemoOpen(true)}
              className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-4 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors gap-1.5"
            >
              <span className="hidden sm:inline">Pedir demonstração</span>
              <span className="sm:hidden">Demo</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero — split layout matching main landing's pattern */}
      <section className="relative pt-24 pb-12 md:pt-28 md:pb-16">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-emerald-500/3 to-background" />
        <div className="absolute top-10 right-10 w-[500px] h-[500px] rounded-full bg-primary/15 blur-[120px]" />
        <div className="absolute top-40 left-0 w-80 h-80 rounded-full bg-emerald-400/12 blur-[100px]" />

        <div className="relative mx-auto max-w-6xl px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary mb-6">
                <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                {kicker}
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08]">
                {title}{" "}
                <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
                  {highlight}
                </span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed mx-auto lg:mx-0">
                {intro}
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <button
                  onClick={() => setDemoOpen(true)}
                  className={buttonVariants({ size: "lg", className: "gap-2 w-full sm:w-auto shadow-lg shadow-primary/20" })}
                >
                  Pedir demonstração
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => scrollTo("features")}
                  className={buttonVariants({ variant: "outline", size: "lg", className: "gap-2 w-full sm:w-auto" })}
                >
                  Ver funcionalidades
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 w-full max-w-lg">{heroMockup}</div>
          </div>
        </div>
      </section>

      {/* Features — themed to this page's keyword cluster */}
      <section id="features" className="py-14 md:py-20 relative bg-gradient-to-b from-background via-primary/[0.02] to-background">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[150px]" />

        <div className="relative mx-auto max-w-6xl px-6">
          <div className="text-center max-w-xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary mb-4">
              Funcionalidades
            </div>
            <h2 className="text-3xl md:text-4xl font-bold">O que pode fazer com o Convlyx</h2>
          </div>

          <div className={`grid gap-6 ${features.length >= 4 ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-3"}`}>
            {features.map((f) => (
              <FeatureCard
                key={f.title}
                icon={f.icon}
                title={f.title}
                description={f.description}
                gradient={f.gradient}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Mid CTA — green band breaks the white run */}
      {midCta && (
        <section className="relative py-12 md:py-14 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-700 via-primary to-emerald-600" />
          <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-white/8" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-emerald-300/10" />
          <div className="relative mx-auto max-w-4xl px-6 text-center text-primary-foreground">
            <h2 className="text-2xl md:text-3xl font-bold">{midCta.title}</h2>
            <p className="mt-3 text-base md:text-lg opacity-85 max-w-2xl mx-auto leading-relaxed">
              {midCta.description}
            </p>
            <div className="mt-6">
              <button
                onClick={() => setDemoOpen(true)}
                className="inline-flex items-center justify-center rounded-lg bg-white text-primary px-7 py-3 text-sm font-semibold hover:bg-white/90 transition-all cursor-pointer gap-2 shadow-lg shadow-black/10 hover:scale-105"
              >
                Pedir demonstração
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Deep dive — keyword-rich split section with mockup */}
      <section id="saber-mais" className="py-14 md:py-20 relative">
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-emerald-400/8 blur-[120px]" />
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-primary/5 blur-[80px]" />

        <div className="relative mx-auto max-w-6xl px-6">
          <div className={`flex flex-col gap-12 items-center ${mockupOnLeft ? "lg:flex-row-reverse" : "lg:flex-row"}`}>
            <div className="flex-1 space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                {deepDive.kicker}
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{deepDive.title}</h2>
              {deepDive.body.map((p, i) => (
                <p key={i} className="text-base md:text-lg text-muted-foreground leading-relaxed">
                  {p}
                </p>
              ))}
              {deepDive.bullets && deepDive.bullets.length > 0 && (
                <ul className="space-y-3 pt-2">
                  {deepDive.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-sm md:text-base text-foreground/80 leading-relaxed">{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex-1 w-full max-w-lg">{deepDive.mockup}</div>
          </div>
        </div>
      </section>

      {/* Related pages — internal linking */}
      {related && related.length > 0 && (
        <section className="py-12 md:py-14 bg-muted/30">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className="text-xl md:text-2xl font-semibold text-center mb-8">Saiba mais</h2>
            <ul className="grid gap-4 md:grid-cols-2">
              {related.map((r) => (
                <li key={r.href}>
                  <Link
                    href={r.href}
                    className="group flex items-start gap-3 rounded-2xl border bg-card p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all h-full"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors">{r.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{r.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section id="demo" className="relative py-16 md:py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-700 via-primary to-emerald-600" />
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-white/8" />
        <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-emerald-300/10" />
        <div className="absolute top-1/2 left-1/4 h-48 w-48 rounded-full bg-white/5 blur-3xl" />

        <div className="relative mx-auto max-w-3xl px-6 text-center text-primary-foreground">
          <h2 className="text-2xl md:text-3xl font-bold">Pronto para experimentar o Convlyx?</h2>
          <p className="mt-3 text-base opacity-80 max-w-xl mx-auto">
            Peça uma demonstração gratuita e veja como o Convlyx pode simplificar a gestão da sua escola de condução.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setDemoOpen(true)}
              className="inline-flex items-center justify-center rounded-lg bg-white text-primary px-8 py-3.5 text-sm font-semibold hover:bg-white/90 transition-all cursor-pointer gap-2 shadow-lg shadow-black/10 hover:scale-105"
            >
              Pedir demonstração
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-8">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm opacity-80 hover:opacity-100 transition-opacity"
            >
              Voltar à página inicial
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter onRequestDemo={() => setDemoOpen(true)} />

      <DemoDialog open={demoOpen} onOpenChange={setDemoOpen} />
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  gradient,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <div
      className={`group rounded-2xl border p-6 shadow-md shadow-primary/3 hover:shadow-xl hover:shadow-primary/10 transition-all hover:border-primary/20 hover:-translate-y-1 bg-gradient-to-br ${gradient} backdrop-blur-sm`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/80 dark:bg-white/10 mb-4 group-hover:scale-110 transition-transform shadow-sm">
        {icon}
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

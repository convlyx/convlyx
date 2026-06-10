"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRight, Check, ChevronRight } from "lucide-react";
import { SiteFooter } from "./site-footer";
import { DemoDialog } from "./demo-dialog";
import { Eyebrow, SectionHeading, Reveal } from "./landing/_primitives";

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
  /** tailwind gradient classes — kept for back-compat; no longer used visually. */
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
    <div className="landing-scope min-h-screen overflow-hidden">
      {/* Floating pill nav */}
      <nav className="fixed top-0 right-0 left-0 z-50 px-4 pt-3 sm:px-6 sm:pt-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between rounded-full border border-[var(--landing-forest)]/12 bg-white/95 py-2 pr-2 pl-4 shadow-[0_8px_30px_rgba(16,80,40,0.10)] sm:pl-5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-[var(--landing-green)] to-[var(--landing-forest)] shadow-sm shadow-[var(--landing-forest)]/25">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/favicon.png" alt="" width={20} height={20} className="brightness-0 invert" />
            </div>
            <span className="text-base font-extrabold tracking-tight text-[var(--landing-ink)]">Convlyx</span>
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollTo("features")}
              className="hidden cursor-pointer rounded-full px-3.5 py-2 text-sm font-semibold text-[var(--landing-muted)] transition-colors hover:bg-[var(--landing-green)]/8 hover:text-[var(--landing-forest)] sm:block"
            >
              Funcionalidades
            </button>
            <button
              type="button"
              onClick={() => scrollTo("saber-mais")}
              className="hidden cursor-pointer rounded-full px-3.5 py-2 text-sm font-semibold text-[var(--landing-muted)] transition-colors hover:bg-[var(--landing-green)]/8 hover:text-[var(--landing-forest)] md:block"
            >
              Saber mais
            </button>
            <button
              type="button"
              onClick={() => setDemoOpen(true)}
              className="ml-1 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full bg-[var(--landing-forest)] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-[var(--landing-forest)]/30 transition-colors hover:bg-[var(--landing-green)]"
            >
              <span className="hidden sm:inline">Pedir demonstração</span>
              <span className="sm:hidden">Demo</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero — full-bleed sage gradient */}
      <section className="landing-hero-bg relative px-6 pt-28 pb-16 md:pt-32 md:pb-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center gap-12 lg:flex-row lg:gap-16">
            <div className="flex-1 text-center lg:text-left">
              <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.04em] text-[var(--landing-muted)]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--landing-green)] ring-4 ring-[var(--landing-green)]/15" />
                {kicker}
              </span>
              <h1 className="mt-4 text-4xl leading-[1.05] font-extrabold tracking-tight text-[var(--landing-ink)] md:text-5xl lg:text-6xl">
                {title}{" "}
                <span className="font-accent font-semibold text-[var(--landing-forest)]">{highlight}</span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[var(--landing-muted)] lg:mx-0">
                {intro}
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                <button
                  type="button"
                  onClick={() => setDemoOpen(true)}
                  className={buttonVariants({
                    size: "lg",
                    className:
                      "w-full cursor-pointer gap-2 bg-[var(--landing-green)] text-white shadow-lg shadow-[var(--landing-forest)]/25 hover:bg-[var(--landing-forest)] sm:w-auto",
                  })}
                >
                  Pedir demonstração
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollTo("features")}
                  className={buttonVariants({
                    variant: "outline",
                    size: "lg",
                    className:
                      "w-full cursor-pointer gap-2 border-[var(--landing-forest)]/25 bg-white text-[var(--landing-forest)] hover:border-[var(--landing-forest)]/40 hover:bg-white hover:text-[var(--landing-forest)] sm:w-auto",
                  })}
                >
                  Ver funcionalidades
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="w-full max-w-lg flex-1">{heroMockup}</div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-14 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            eyebrow={<Eyebrow>Funcionalidades</Eyebrow>}
            title="O que pode fazer com o"
            accent="Convlyx"
          />
          <Reveal
            className={`grid gap-5 ${
              features.length >= 4 ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-3"
            }`}
          >
            {features.map((f) => (
              <FeatureCard key={f.title} icon={f.icon} title={f.title} description={f.description} />
            ))}
          </Reveal>
        </div>
      </section>

      {/* Mid CTA — green band */}
      {midCta && (
        <section className="relative overflow-hidden py-12 md:py-16">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--landing-forest),#166534)]" />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
          <div className="relative mx-auto max-w-4xl px-6 text-center text-white">
            <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">{midCta.title}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed opacity-85 md:text-lg">
              {midCta.description}
            </p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setDemoOpen(true)}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-white px-7 py-3 text-sm font-semibold text-[var(--landing-forest)] shadow-lg shadow-black/10 transition-all hover:scale-105 hover:bg-white/90"
              >
                Pedir demonstração
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Deep dive — split with mockup */}
      <section id="saber-mais" className="py-14 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal
            className={`flex flex-col items-center gap-12 ${
              mockupOnLeft ? "lg:flex-row-reverse" : "lg:flex-row"
            }`}
          >
            <div className="flex-1 space-y-5">
              <Eyebrow>{deepDive.kicker}</Eyebrow>
              <h2 className="text-3xl font-extrabold tracking-tight text-[var(--landing-ink)] md:text-4xl">
                {deepDive.title}
              </h2>
              {deepDive.body.map((p, i) => (
                <p key={i} className="text-base leading-relaxed text-[var(--landing-muted)] md:text-lg">
                  {p}
                </p>
              ))}
              {deepDive.bullets && deepDive.bullets.length > 0 && (
                <ul className="space-y-3 pt-2">
                  {deepDive.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--landing-green)]/12 text-[var(--landing-forest)]">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-sm leading-relaxed text-[var(--landing-ink)]/85 md:text-base">{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="w-full max-w-lg flex-1">{deepDive.mockup}</div>
          </Reveal>
        </div>
      </section>

      {/* Related pages — internal linking */}
      {related && related.length > 0 && (
        <section className="py-12 md:py-14">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className="mb-8 text-center text-xl font-bold text-[var(--landing-ink)] md:text-2xl">
              Saiba mais
            </h2>
            <ul className="grid gap-4 md:grid-cols-2">
              {related.map((r) => (
                <li key={r.href}>
                  <Link
                    href={r.href}
                    className="group flex h-full items-start gap-3 rounded-2xl border border-[var(--landing-forest)]/10 bg-white p-5 shadow-sm shadow-[var(--landing-forest)]/5 transition-all hover:-translate-y-0.5 hover:border-[var(--landing-forest)]/20 hover:shadow-lg hover:shadow-[var(--landing-forest)]/10"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 text-sm font-semibold text-[var(--landing-ink)] transition-colors group-hover:text-[var(--landing-forest)]">
                        {r.title}
                      </p>
                      <p className="text-xs leading-relaxed text-[var(--landing-muted)]">{r.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--landing-muted)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--landing-forest)]" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Final CTA — green band */}
      <section id="demo" className="relative overflow-hidden py-16 md:py-20">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--landing-forest),#166534)]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/8" />
        <div className="relative mx-auto max-w-3xl px-6 text-center text-white">
          <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">
            Pronto para experimentar o{" "}
            <span className="font-accent font-semibold text-[var(--landing-accent-soft)]">Convlyx?</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base opacity-80">
            Peça uma demonstração gratuita e veja como o Convlyx pode simplificar a gestão da sua escola
            de condução.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setDemoOpen(true)}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-white px-8 py-3.5 text-sm font-semibold text-[var(--landing-forest)] shadow-lg shadow-black/10 transition-all hover:scale-105 hover:bg-white/90"
            >
              Pedir demonstração
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-8">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm opacity-80 transition-opacity hover:opacity-100"
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
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group rounded-2xl border border-[var(--landing-forest)]/10 bg-white p-6 shadow-sm shadow-[var(--landing-forest)]/5 transition-all hover:-translate-y-1 hover:border-[var(--landing-forest)]/20 hover:shadow-xl hover:shadow-[var(--landing-forest)]/10">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--landing-green)]/10 transition-transform group-hover:scale-110">
        {icon}
      </div>
      <h3 className="mb-2 font-semibold text-[var(--landing-ink)]">{title}</h3>
      <p className="text-sm leading-relaxed text-[var(--landing-muted)]">{description}</p>
    </div>
  );
}

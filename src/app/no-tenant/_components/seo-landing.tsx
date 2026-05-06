"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRight, Check, ChevronRight } from "lucide-react";

export function SeoLanding({
  kicker,
  title,
  highlight,
  intro,
  bullets,
  body,
}: {
  kicker: string;
  /** First half of the H1 (in normal weight) */
  title: string;
  /** Highlighted span that follows the title in the H1 */
  highlight: string;
  /** Short intro paragraph below the H1 */
  intro: string;
  /** Three bullet points */
  bullets: string[];
  /** Two long-form paragraphs of keyword-rich body copy */
  body: string[];
}) {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/70 backdrop-blur-xl border-b border-primary/5">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-emerald-500 shadow-md shadow-primary/20">
              <img src="/favicon.png" alt="" width={22} height={22} className="brightness-0 invert" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">Convlyx</span>
          </Link>
          <Link
            href="/#demo"
            className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-4 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors gap-1.5"
          >
            Pedir demonstração
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </nav>

      <section className="relative pt-28 pb-12 md:pt-32 md:pb-16">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/8 via-emerald-500/3 to-background" />
        <div className="absolute top-10 right-10 w-[500px] h-[500px] rounded-full bg-primary/15 blur-[120px] -z-10" />

        <div className="mx-auto max-w-3xl px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary mb-6">
            <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            {kicker}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.1]">
            {title}{" "}
            <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
              {highlight}
            </span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">{intro}</p>
          <div className="mt-8">
            <Link
              href="/#demo"
              className={buttonVariants({ size: "lg", className: "gap-2 shadow-lg shadow-primary/20" })}
            >
              Pedir demonstração
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="mx-auto max-w-3xl px-6">
          <ul className="grid gap-4 md:grid-cols-3">
            {bullets.map((b) => (
              <li
                key={b}
                className="flex items-start gap-3 rounded-2xl border bg-card p-5 shadow-sm"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Check className="h-4 w-4" />
                </div>
                <span className="text-sm leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="mx-auto max-w-3xl px-6 space-y-5 text-base md:text-lg text-muted-foreground leading-relaxed">
          {body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </section>

      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-700 via-primary to-emerald-600" />
        <div className="relative mx-auto max-w-3xl px-6 text-center text-primary-foreground">
          <h2 className="text-2xl md:text-3xl font-bold">Pronto para experimentar o Convlyx?</h2>
          <p className="mt-3 text-base opacity-80 max-w-xl mx-auto">
            Peça uma demonstração gratuita e veja como o Convlyx pode simplificar a gestão da sua escola de condução.
          </p>
          <div className="mt-6">
            <Link
              href="/#demo"
              className="inline-flex items-center justify-center rounded-lg bg-white text-primary px-7 py-3 text-sm font-semibold hover:bg-white/90 transition-all gap-2 shadow-lg shadow-black/10"
            >
              Pedir demonstração
              <ArrowRight className="h-4 w-4" />
            </Link>
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
    </div>
  );
}

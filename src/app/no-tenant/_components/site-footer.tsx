"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

/**
 * Universal footer used on the main landing page and all SEO landing pages.
 * Anchor buttons rely on each page exposing the same ids: `#features` and `#demo`.
 */
export function SiteFooter() {
  const t = useTranslations();

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <footer className="relative border-t bg-gradient-to-b from-background to-primary/3 py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-emerald-500 shadow-md shadow-primary/20">
              <img src="/favicon.png" alt="" width={22} height={22} className="brightness-0 invert" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">
              {t("common.appName")}
            </span>
          </Link>

          {/* Description */}
          <p className="text-sm text-muted-foreground text-center max-w-md">
            {t("common.appDescription")}
          </p>

          {/* In-page anchors */}
          <div className="flex items-center gap-6 text-sm">
            <button
              onClick={() => scrollTo("features")}
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              {t("landing.seeFeatures")}
            </button>
            <button
              onClick={() => scrollTo("demo")}
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              {t("landing.requestDemo")}
            </button>
          </div>

          {/* Divider */}
          <div className="w-full max-w-xs h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

          {/* SEO sub-pages */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <Link href="/software-escola-conducao" className="hover:text-primary transition-colors">
              Software para escolas de condução
            </Link>
            <Link href="/calendario-aulas-conducao" className="hover:text-primary transition-colors">
              Calendário de aulas
            </Link>
            <Link href="/gestao-alunos-conducao" className="hover:text-primary transition-colors">
              Gestão de alunos
            </Link>
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
  );
}

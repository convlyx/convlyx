"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

const SOCIAL_LINKS = [
  { href: "https://www.instagram.com/convlyx/", label: "Instagram", Icon: InstagramIcon },
  { href: "https://www.facebook.com/profile.php?id=61589251470921", label: "Facebook", Icon: FacebookIcon },
];

/**
 * Universal footer used on the main landing page and all SEO landing pages.
 * Anchor buttons rely on each page exposing the same ids: `#features` and `#demo`.
 */
export function SiteFooter({ onRequestDemo }: { onRequestDemo?: () => void } = {}) {
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
            <span className="text-lg font-bold text-foreground">
              {t("common.appName")}
            </span>
          </Link>

          {/* Description */}
          <p className="text-sm text-muted-foreground text-center max-w-md">
            {t("common.appDescription")}
          </p>

          {/* Social links */}
          <div className="flex items-center gap-3">
            {SOCIAL_LINKS.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="me noopener noreferrer"
                aria-label={label}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/15 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>

          {/* In-page anchors */}
          <div className="flex items-center gap-6 text-sm">
            <button
              onClick={() => scrollTo("features")}
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              {t("landing.seeFeatures")}
            </button>
            <button
              onClick={onRequestDemo ?? (() => scrollTo("demo"))}
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
            <Link href="/novidades" className="hover:text-primary transition-colors">
              {t("novidades.title")}
            </Link>
          </div>

          {/* Divider */}
          <div className="w-full max-w-xs h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

          {/* Legal links */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <Link href="/politica-de-privacidade" className="hover:text-primary transition-colors">
              Política de Privacidade
            </Link>
            <Link href="/termos-e-condicoes" className="hover:text-primary transition-colors">
              Termos e Condições
            </Link>
            <Link href="/politica-de-cookies" className="hover:text-primary transition-colors">
              Política de Cookies
            </Link>
            <Link href="/contrato-de-subcontratacao" className="hover:text-primary transition-colors">
              Contrato de Subcontratação
            </Link>
          </div>

          {/* Copyright */}
          <p className="text-xs text-muted-foreground">
            {t("auth.copyright", { year: new Date().getFullYear().toString() })}
          </p>
        </div>
      </div>
    </footer>
  );
}

"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { SiteFooter } from "@/app/no-tenant/_components/site-footer";

/**
 * Shared layout for legal pages (privacy, terms, cookies).
 * Plain typography on a contained column with a back-to-home link
 * and the universal site footer.
 */
export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  /** ISO date string, e.g. "2026-05-08" */
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/70 backdrop-blur-xl border-b border-primary/5">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-emerald-500 shadow-md shadow-primary/20">
              <img src="/favicon.png" alt="" width={22} height={22} className="brightness-0 invert" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">
              Convlyx
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Início
          </Link>
        </div>
      </nav>

      <article className="flex-1 mx-auto max-w-3xl w-full px-6 pt-28 pb-16">
        <header className="mb-10 pb-6 border-b">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Última atualização:{" "}
            <time dateTime={lastUpdated}>
              {new Date(lastUpdated).toLocaleDateString("pt-PT", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </time>
          </p>
        </header>

        <div className="prose-legal space-y-6 text-base leading-relaxed text-foreground/90">
          {children}
        </div>
      </article>

      <SiteFooter />
    </div>
  );
}

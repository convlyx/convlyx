"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DemoDialog } from "@/app/no-tenant/_components/demo-dialog";

/**
 * Soft conversion at the end of every blog article: a "pedir demonstração"
 * band that opens the shared DemoDialog. Keeps the article page a Server
 * Component while the CTA stays interactive.
 */
export function ArticleCta({
  title = "Simplifique a gestão da sua escola de condução",
  description = "Em 30 minutos mostramos-lhe como o Convlyx reúne agenda, alunos, instrutores e exames do IMT numa só plataforma.",
}: {
  title?: string;
  description?: string;
}) {
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <>
      <aside className="my-12 overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/8 to-emerald-500/8 p-8 text-center">
        <h2 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">{title}</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
          {description}
        </p>
        <button
          type="button"
          onClick={() => setDemoOpen(true)}
          className="mt-6 inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:scale-105 hover:bg-primary/90"
        >
          Pedir demonstração
          <ArrowRight className="h-4 w-4" />
        </button>
        <div className="mt-4">
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground underline underline-offset-4 transition-colors hover:text-primary"
          >
            Conhecer melhor o Convlyx
          </Link>
        </div>
      </aside>

      <DemoDialog open={demoOpen} onOpenChange={setDemoOpen} />
    </>
  );
}

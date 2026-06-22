"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

/** "← Voltar" link shown at the top of detail pages. */
export function DetailBackLink({ href }: { href: string }) {
  const t = useTranslations();
  return (
    <Link href={href} className="inline-flex">
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 -ml-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("common.back")}
      </Button>
    </Link>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { CheckCircle2, RotateCcw, MinusCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ImportResult } from "./use-bulk-import";

type Props = {
  results: ImportResult[];
  onImportAnother: () => void;
  onDone: () => void;
};

const STATUS_META = {
  created: { icon: CheckCircle2, className: "text-success" },
  reactivated: { icon: RotateCcw, className: "text-info" },
  skipped: { icon: MinusCircle, className: "text-warning" },
  failed: { icon: XCircle, className: "text-destructive" },
} as const;

export function ResultsStep({ results, onImportAnother, onDone }: Props) {
  const t = useTranslations("students.import");
  const tErrors = useTranslations();

  const counts = {
    created: results.filter((r) => r.status === "created").length,
    reactivated: results.filter((r) => r.status === "reactivated").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "failed").length,
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium">{t("results.title")}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t("results.summary", counts)}
        </p>
      </div>

      <ul className="rounded-xl border divide-y max-h-[50vh] overflow-y-auto">
        {results.map((result, i) => {
          const meta = STATUS_META[result.status];
          const Icon = meta.icon;
          return (
            <li key={`${result.email}-${i}`} className="flex items-center gap-3 p-3 text-sm">
              <Icon className={`h-4 w-4 shrink-0 ${meta.className}`} aria-hidden="true" />
              <span className="flex-1 min-w-0 truncate">{result.email}</span>
              <span className={`text-xs ${meta.className}`}>
                {t(`results.${result.status}`)}
                {result.reason ? ` · ${tErrors(result.reason)}` : ""}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onImportAnother}>
          {t("results.importAnother")}
        </Button>
        <Button type="button" onClick={onDone}>
          {t("results.done")}
        </Button>
      </div>
    </div>
  );
}

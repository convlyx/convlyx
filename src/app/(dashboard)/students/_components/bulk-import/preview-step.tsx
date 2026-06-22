"use client";

import { useTranslations } from "next-intl";
import { CheckCircle2, AlertCircle, RotateCcw, Trash2 } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CategorySelect } from "@/components/category-select";
import type { LicenseCategory } from "@/lib/license-categories";
import type { RowErrorCode, WorkingRow } from "./row-validation";

type Props = {
  rows: WorkingRow[];
  rowErrors: Map<string, RowErrorCode[]>;
  importableCount: number;
  onUpdateRow: (id: string, patch: Partial<WorkingRow>) => void;
  onRemoveRow: (id: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
};

export function PreviewStep({
  rows,
  rowErrors,
  importableCount,
  onUpdateRow,
  onRemoveRow,
  onBack,
  onSubmit,
  submitting,
}: Props) {
  const t = useTranslations("students.import");

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium">{t("preview.title")}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t("preview.hint")}</p>
      </div>

      <p className="text-sm font-medium">
        {t("preview.summary", { importable: importableCount, total: rows.length })}
      </p>

      <div className="rounded-xl border overflow-x-auto max-h-[50vh]">
        <Table>
          <caption className="sr-only">{t("preview.title")}</caption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">{t("preview.status")}</TableHead>
              <TableHead>{t("mapping.fields.name")}</TableHead>
              <TableHead>{t("mapping.fields.email")}</TableHead>
              <TableHead>{t("mapping.fields.phone")}</TableHead>
              <TableHead className="w-[170px]">{t("mapping.fields.category")}</TableHead>
              <TableHead className="w-[44px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const errors = rowErrors.get(row.id) ?? [];
              const isActive = row.existing === "ACTIVE";
              const hasError = !isActive && errors.length > 0;
              const fieldError = (code: RowErrorCode) => !isActive && errors.includes(code);

              return (
                <TableRow key={row.id} className={isActive ? "opacity-60" : undefined}>
                  <TableCell className="align-top">
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                        <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("preview.alreadyActive")}
                      </span>
                    ) : hasError ? (
                      <span className="flex flex-col gap-0.5 text-xs text-destructive">
                        {errors.map((code) => (
                          <span key={code} className="inline-flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            {t(`rowErrors.${code}`)}
                          </span>
                        ))}
                      </span>
                    ) : row.existing === "INACTIVE" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("preview.willReactivate")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("preview.valid")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <Input
                      aria-label={t("mapping.fields.name")}
                      value={row.name}
                      disabled={isActive}
                      onChange={(e) => onUpdateRow(row.id, { name: e.target.value })}
                      className={fieldError("nameRequired") ? "border-destructive" : undefined}
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <Input
                      aria-label={t("mapping.fields.email")}
                      type="email"
                      value={row.email}
                      disabled={isActive}
                      onChange={(e) => onUpdateRow(row.id, { email: e.target.value })}
                      className={
                        fieldError("emailInvalid") || fieldError("emailDuplicate")
                          ? "border-destructive"
                          : undefined
                      }
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <Input
                      aria-label={t("mapping.fields.phone")}
                      type="tel"
                      value={row.phone}
                      disabled={isActive}
                      onChange={(e) => onUpdateRow(row.id, { phone: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <CategorySelect
                      value={row.category}
                      onChange={(category: LicenseCategory) => onUpdateRow(row.id, { category })}
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onRemoveRow(row.id)}
                      title={t("preview.remove")}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">{t("preview.remove")}</span>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between gap-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={submitting}>
          {t("preview.back")}
        </Button>
        <Button type="button" onClick={onSubmit} disabled={submitting || importableCount === 0}>
          {submitting ? t("preview.submitting") : t("preview.submit", { count: importableCount })}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/radix-select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CategorySelect } from "@/components/category-select";
import type { LicenseCategory } from "@/lib/license-categories";
import { IMPORT_FIELDS, type ImportField } from "./column-detect";
import type { ColumnMapping } from "./use-bulk-import";

const REQUIRED_FIELDS: ImportField[] = ["name", "email"];
const NONE = "__none__";

type Props = {
  headers: string[];
  mapping: ColumnMapping;
  onFieldMapping: (field: ImportField, header: string | null) => void;
  schools: Array<{ id: string; name: string }> | undefined;
  schoolId: string;
  onSchoolId: (id: string) => void;
  defaultCategory: LicenseCategory | "";
  onDefaultCategory: (category: LicenseCategory) => void;
  onContinue: () => void;
};

export function MappingStep({
  headers,
  mapping,
  onFieldMapping,
  schools,
  schoolId,
  onSchoolId,
  defaultCategory,
  onDefaultCategory,
  onContinue,
}: Props) {
  const t = useTranslations("students.import");
  const showSchoolPicker = (schools?.length ?? 0) > 1;

  const canContinue =
    REQUIRED_FIELDS.every((f) => !!mapping[f]) && !!schoolId && !!defaultCategory;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium">{t("mapping.title")}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t("mapping.hint")}</p>
      </div>

      <div className="grid gap-3">
        {IMPORT_FIELDS.map((field) => {
          const required = REQUIRED_FIELDS.includes(field);
          return (
            <div key={field} className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-center sm:gap-3">
              <Label htmlFor={`map-${field}`}>
                {t(`mapping.fields.${field}`)}{" "}
                <span className="text-xs text-muted-foreground">
                  ({t(required ? "mapping.required" : "mapping.optional")})
                </span>
              </Label>
              <Select
                value={mapping[field] ?? NONE}
                onValueChange={(v) => onFieldMapping(field, v === NONE ? null : v)}
              >
                <SelectTrigger id={`map-${field}`} className="w-full">
                  <SelectValue placeholder={t("mapping.fieldColumn")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("mapping.none")}</SelectItem>
                  {headers.map((header) => (
                    <SelectItem key={header} value={header}>
                      {header}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>

      <div className="border-t pt-4 grid gap-3">
        {showSchoolPicker && (
          <div className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-center sm:gap-3">
            <Label htmlFor="map-school">{t("mapping.school")}</Label>
            <Select value={schoolId} onValueChange={onSchoolId}>
              <SelectTrigger id="map-school" className="w-full">
                <SelectValue placeholder={t("mapping.school")} />
              </SelectTrigger>
              <SelectContent>
                {schools?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-center sm:gap-3">
          <Label>{t("mapping.defaultCategory")}</Label>
          <div className="space-y-1">
            <CategorySelect
              value={defaultCategory}
              onChange={onDefaultCategory}
              placeholder={t("mapping.defaultCategory")}
            />
            <p className="text-xs text-muted-foreground">{t("mapping.defaultCategoryHint")}</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={onContinue} disabled={!canContinue}>
          {t("mapping.continue")}
        </Button>
      </div>
    </div>
  );
}

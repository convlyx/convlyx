"use client";

import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/radix-select";
import { LICENSE_CATEGORIES, type LicenseCategory } from "@/lib/license-categories";

type Props = {
  value: LicenseCategory | "";
  onChange: (value: LicenseCategory) => void;
  placeholder?: string;
  /** Optional set of categories to restrict to. Defaults to all. */
  allowedCategories?: readonly LicenseCategory[];
};

export function CategorySelect({ value, onChange, placeholder, allowedCategories }: Props) {
  const t = useTranslations();
  const options = allowedCategories ?? LICENSE_CATEGORIES;

  return (
    <Select value={value} onValueChange={(v) => onChange(v as LicenseCategory)}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder ?? t("categories.label")} />
      </SelectTrigger>
      <SelectContent>
        {options.map((cat) => (
          <SelectItem key={cat} value={cat}>
            <span className="font-medium">{t(`categories.${cat}`)}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

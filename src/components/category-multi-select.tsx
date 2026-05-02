"use client";

import { useTranslations } from "next-intl";
import { LICENSE_CATEGORIES, type LicenseCategory } from "@/lib/license-categories";

type Props = {
  value: LicenseCategory[];
  onChange: (value: LicenseCategory[]) => void;
};

export function CategoryMultiSelect({ value, onChange }: Props) {
  const t = useTranslations();

  function toggle(cat: LicenseCategory) {
    if (value.includes(cat)) {
      onChange(value.filter((c) => c !== cat));
    } else {
      onChange([...value, cat]);
    }
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {LICENSE_CATEGORIES.map((cat) => {
        const checked = value.includes(cat);
        return (
          <label
            key={cat}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${
              checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(cat)}
              className="accent-primary"
            />
            <span className="font-medium">{t(`categories.${cat}`)}</span>
          </label>
        );
      })}
    </div>
  );
}

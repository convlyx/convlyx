"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Search, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";

type Student = {
  id: string;
  name: string;
  email: string;
};

export function StudentPicker({
  students,
  selected,
  onChange,
  max = 2,
}: {
  students: Student[];
  selected: string[];
  onChange: (ids: string[]) => void;
  max?: number;
}) {
  const t = useTranslations("common");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout>>(null);

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase())
  );

  const selectedStudents = students.filter((s) => selected.includes(s.id));

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else if (selected.length < max) {
      onChange([...selected, id]);
    }
  }

  function remove(id: string) {
    onChange(selected.filter((s) => s !== id));
  }

  // Select all visible (unselected) up to max
  const unselectedVisible = filtered.filter((s) => !selected.includes(s.id));
  const canSelectMore = max - selected.length;
  const allVisibleSelected = unselectedVisible.length === 0 && filtered.length > 0;

  function selectAllVisible() {
    const toAdd = unselectedVisible.slice(0, canSelectMore).map((s) => s.id);
    onChange([...selected, ...toAdd]);
  }

  function deselectAllVisible() {
    const visibleIds = new Set(filtered.map((s) => s.id));
    onChange(selected.filter((id) => !visibleIds.has(id)));
  }

  function handleFocus() {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
    setOpen(true);
  }

  function handleBlur() {
    blurTimeout.current = setTimeout(() => setOpen(false), 150);
  }

  return (
    <div className="space-y-2">
      {/* Selected chips */}
      {selectedStudents.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedStudents.map((student) => (
            <span
              key={student.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium"
            >
              {student.name}
              <button
                type="button"
                onClick={() => remove(student.id)}
                className="flex h-3.5 w-3.5 items-center justify-center rounded-full cursor-pointer hover:bg-primary/20 transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search + select all bar */}
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={t("searchStudent")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className="pl-8 h-8 text-sm"
          />
        </div>
        {students.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={allVisibleSelected ? deselectAllVisible : selectAllVisible}
            disabled={!allVisibleSelected && canSelectMore === 0}
          >
            {allVisibleSelected ? t("deselectAll") : t("selectAll")}
          </Button>
        )}

        {/* Student checklist — shown on focus */}
        {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-52 overflow-y-auto rounded-lg border bg-popover shadow-md divide-y">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3 text-center">{t("noResults")}</p>
          ) : (
            filtered.map((student) => {
              const isSelected = selected.includes(student.id);
              const isDisabled = !isSelected && selected.length >= max;
              return (
                <button
                  key={student.id}
                  type="button"
                  disabled={isDisabled}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggle(student.id)}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-left cursor-pointer hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                    isSelected
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-input"
                  }`}>
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                  <UserAvatar name={student.name} className="h-7 w-7 bg-primary/10 text-primary text-[10px]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{student.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{student.email}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {t("studentsSelected", { count: selected.length, max })}
      </p>
    </div>
  );
}

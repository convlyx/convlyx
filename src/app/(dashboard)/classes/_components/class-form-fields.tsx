"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
  type UseFormRegister,
} from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/radix-select";
import { CategorySelect } from "@/components/category-select";
import { DatePicker, TimePicker } from "@/components/date-picker";
import type { LicenseCategory } from "@/lib/license-categories";

/**
 * Reusable, react-hook-form-wired field blocks shared by the create and edit
 * class dialogs. Each renders the standard `Label + control + error` layout so
 * the two dialogs stay in lockstep. They're generic over the form's field
 * values, so the field `name` is type-checked against the form schema.
 */

export function ClassCategoryField<T extends FieldValues>({
  control,
  name,
  error,
}: {
  control: Control<T>;
  name: Path<T>;
  error?: string;
}) {
  const t = useTranslations();
  return (
    <div className="grid gap-2">
      <Label>{t("classes.category")}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <CategorySelect
            value={(field.value ?? "") as LicenseCategory | ""}
            onChange={field.onChange}
            placeholder={t("classes.categoryRequired")}
          />
        )}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function ClassInstructorField<T extends FieldValues>({
  control,
  name,
  instructors,
  error,
}: {
  control: Control<T>;
  name: Path<T>;
  instructors: { id: string; name: string }[] | undefined;
  error?: string;
}) {
  const t = useTranslations();
  return (
    <div className="grid gap-2">
      <Label>{t("classes.instructor")}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select value={field.value as string} onValueChange={field.onChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("classes.instructor")} />
            </SelectTrigger>
            <SelectContent>
              {instructors?.map((instructor) => (
                <SelectItem key={instructor.id} value={instructor.id}>
                  {instructor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function ClassTitleField<T extends FieldValues>({
  register,
  name,
  id,
  error,
}: {
  register: UseFormRegister<T>;
  name: Path<T>;
  id: string;
  error?: string;
}) {
  const t = useTranslations();
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{t("common.name")}</Label>
      <Input id={id} {...register(name)} />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function ClassDateField<T extends FieldValues>({
  control,
  name,
  error,
}: {
  control: Control<T>;
  name: Path<T>;
  error?: string;
}) {
  const t = useTranslations();
  return (
    <div className="grid gap-2">
      <Label>{t("classes.date")}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <DatePicker value={field.value as string} onChange={field.onChange} />
        )}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function ClassTimeRangeRow<T extends FieldValues>({
  control,
  startName,
  endName,
}: {
  control: Control<T>;
  startName: Path<T>;
  endName: Path<T>;
}) {
  const t = useTranslations();
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="grid gap-2">
        <Label>{t("classes.startTime")}</Label>
        <Controller
          control={control}
          name={startName}
          render={({ field }) => (
            <TimePicker value={field.value as string} onChange={field.onChange} />
          )}
        />
      </div>
      <div className="grid gap-2">
        <Label>{t("classes.endTime")}</Label>
        <Controller
          control={control}
          name={endName}
          render={({ field }) => (
            <TimePicker value={field.value as string} onChange={field.onChange} />
          )}
        />
      </div>
    </div>
  );
}

type QualifiableInstructor = {
  id: string;
  name: string;
  qualifiedCategories?: string[] | null;
};

/**
 * Filters the instructor list to those qualified for the chosen category, and
 * clears the selected instructor if they become unqualified after a category
 * change. Shared by both class dialogs (identical logic). Instructors with no
 * declared qualifications are treated as qualified for everything.
 */
export function useQualifiedInstructors({
  instructors,
  category,
  instructorId,
  onClear,
}: {
  instructors: QualifiableInstructor[] | undefined;
  category: string | null | undefined;
  instructorId: string | undefined;
  onClear: () => void;
}): QualifiableInstructor[] | undefined {
  const filtered =
    category && instructors
      ? instructors.filter(
          (i) =>
            !i.qualifiedCategories?.length ||
            i.qualifiedCategories.includes(category)
        )
      : instructors;

  useEffect(() => {
    if (!category || !instructorId || !instructors) return;
    const current = instructors.find((i) => i.id === instructorId);
    if (
      current &&
      current.qualifiedCategories?.length &&
      !current.qualifiedCategories.includes(category)
    ) {
      onClear();
    }
    // onClear is a fresh closure each render; depend only on the inputs that
    // should re-evaluate qualification.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, instructorId, instructors]);

  return filtered;
}

"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type PasswordInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  /** Wraps the input + toggle button. Use for layout overrides only. */
  containerClassName?: string;
};

/**
 * Password input with a show/hide eye toggle. Drop-in replacement for
 * `<Input type="password" />` — same shadcn styling, plus a right-aligned
 * eye button. The button has `tabIndex={-1}` so keyboard tabbing skips
 * straight from the input to the submit; the user can still click or
 * touch it.
 */
export function PasswordInput({
  className,
  containerClassName,
  ...props
}: PasswordInputProps) {
  const t = useTranslations("auth");
  const [visible, setVisible] = React.useState(false);
  return (
    <div className={cn("relative", containerClassName)}>
      <Input
        type={visible ? "text" : "password"}
        className={cn("pr-9", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        aria-pressed={visible}
        tabIndex={-1}
        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

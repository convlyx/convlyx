"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * A small bordered segmented control (e.g. "Upcoming / Past"). The active
 * option is solid, the rest ghost.
 */
export function SegmentedTabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-lg border p-0.5 w-fit",
        className
      )}
    >
      {options.map((opt) => (
        <Button
          key={opt.value}
          variant={value === opt.value ? "default" : "ghost"}
          size="sm"
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}

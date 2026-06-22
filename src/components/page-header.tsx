import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Standard page header: a title (optional description) on the left and an
 * actions slot on the right that wraps on small screens. Used by list,
 * dashboard, and detail pages so heading scale and layout stay consistent.
 */
export function PageHeader({
  title,
  description,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{title}</h1>
        {description != null ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children != null ? (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}

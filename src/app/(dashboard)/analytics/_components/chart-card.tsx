import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Titled card wrapper for an analytics chart: heading + range subtitle on top,
 * the chart (or its skeleton/empty state) below. Keeps every analytics panel
 * visually identical.
 */
export function ChartCard({
  title,
  subtitle,
  className,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border bg-card p-5 card-shadow space-y-4 animate-in fade-in duration-300",
        className
      )}
    >
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle != null ? (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

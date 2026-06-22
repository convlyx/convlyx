import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Card surface that wraps a `<Table>` on list pages — rounded border + shadow
 * with clipped corners so the table's edges stay inside the radius.
 */
export function DataTableCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border card-shadow overflow-hidden", className)}>
      {children}
    </div>
  );
}

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Rounded icon tile used as the leading visual on list/entity cards. Pass the
 * colour via `className` (e.g. `bg-primary/10 text-primary` or a class-type
 * colour map entry).
 */
export function IconTile({
  icon: Icon,
  className,
}: {
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl",
        className
      )}
    >
      <Icon className="h-5 w-5" />
    </div>
  );
}

"use client";

import { useState } from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Explains a disabled control with the shared (Base UI) tooltip, working on
 * both desktop and mobile: it opens on hover/focus (Base UI's own triggers,
 * via the controlled `open` state) AND on tap — the trigger's `onClick`
 * forces it open and `closeOnClick` is disabled so the tap doesn't immediately
 * dismiss it.
 *
 * The trigger renders as a `span` so a disabled child button (which has
 * `pointer-events-none`) lets the hover/tap fall through to it. Renders the
 * children unwrapped when `content` is empty, so callers can pass the message
 * conditionally without branching at the call site.
 */
export function InfoTooltip({
  content,
  className,
  children,
}: {
  content?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  if (!content) return <>{children}</>;

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        render={<span tabIndex={0} />}
        closeOnClick={false}
        onClick={() => setOpen(true)}
        className={cn("inline-flex cursor-help", className)}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{content}</TooltipContent>
    </Tooltip>
  );
}

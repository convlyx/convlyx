import { CircleCheck, CircleAlert, Sparkles, CircleSlash } from "lucide-react";
import type { SchoolHealth } from "@/server/lib/admin-health";

const MAP = {
  HEALTHY: { label: "Saudável", cls: "text-success", Icon: CircleCheck },
  AT_RISK: { label: "Em risco", cls: "text-warning", Icon: CircleAlert },
  NEW: { label: "Novo", cls: "text-info", Icon: Sparkles },
  INACTIVE: { label: "Inativo", cls: "text-muted-foreground", Icon: CircleSlash },
} as const;

/** Health pill: colour + icon + text (never colour alone — a11y). */
export function HealthBadge({ health }: { health: SchoolHealth }) {
  const { label, cls, Icon } = MAP[health];
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${cls}`}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </span>
  );
}

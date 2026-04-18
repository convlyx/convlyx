import type { LucideIcon } from "lucide-react";

export function StatCard({ icon: Icon, label, value, description }: { icon: LucideIcon; label: string; value: number; description?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 card-shadow hover:card-shadow-hover transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-3xl font-bold">{value}</p>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export function DashboardHomeSkeleton({
  stats = 3,
  rows = 5,
}: {
  stats?: number;
  rows?: number;
} = {}) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Skeleton className="h-8 w-64" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: stats }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 card-shadow space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <div className="grid gap-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border bg-card p-4 card-shadow flex items-start gap-3"
            >
              <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3.5 w-72 max-w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";
import { LoadingAnnounce } from "@/components/loading-announce";

/** A row of stat-card-shaped skeletons matching <StatCard> dimensions. */
export function StatRowSkeleton({ count = 3 }: { count?: number } = {}) {
  // Static class names so Tailwind can pick them up at build time.
  const gridClass =
    count === 2
      ? "grid grid-cols-1 gap-4 sm:grid-cols-2"
      : count >= 4
        ? "grid grid-cols-2 gap-4 lg:grid-cols-4"
        : "grid grid-cols-1 gap-4 sm:grid-cols-3";
  return (
    <div className={`${gridClass} animate-in fade-in duration-300`}>
      <LoadingAnnounce />
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 card-shadow space-y-2">
      <div className="flex items-center justify-between mb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
      </div>
      <Skeleton className="h-8 w-12" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

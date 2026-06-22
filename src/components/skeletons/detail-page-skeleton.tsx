import { Skeleton } from "@/components/ui/skeleton";
import { LoadingAnnounce } from "@/components/loading-announce";

export function DetailPageSkeleton({
  stats = 3,
  sections = 2,
}: {
  stats?: number;
  sections?: number;
} = {}) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <LoadingAnnounce />
      <Skeleton className="h-4 w-24" />

      {/* Header card: avatar + name + meta */}
      <div className="rounded-xl border bg-card p-5 card-shadow">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <Skeleton className="h-16 w-16 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
      </div>

      {/* Stats row */}
      {stats > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: stats }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-5 card-shadow space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-8 w-12" />
            </div>
          ))}
        </div>
      )}

      {/* Content sections */}
      {Array.from({ length: sections }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-5 card-shadow space-y-4">
          <Skeleton className="h-6 w-40" />
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

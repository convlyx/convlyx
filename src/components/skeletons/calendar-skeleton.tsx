import { Skeleton } from "@/components/ui/skeleton";
import { LoadingAnnounce } from "@/components/loading-announce";

export function CalendarSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <LoadingAnnounce />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-8 w-32" />
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-[130px]" />
          <Skeleton className="h-9 w-[150px]" />
          <Skeleton className="h-9 w-[120px]" />
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 card-shadow space-y-3">
        {/* Toolbar: prev/next, title, view toggle */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-16 ml-2" />
          </div>
          <Skeleton className="h-6 w-48" />
          <div className="flex items-center gap-1">
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-9 w-16" />
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-px">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>

        {/* Month grid: 6 weeks */}
        <div className="grid grid-cols-7 gap-px">
          {Array.from({ length: 42 }).map((_, i) => (
            <Skeleton key={i} className="h-20 sm:h-24 w-full rounded-sm" />
          ))}
        </div>
      </div>
    </div>
  );
}

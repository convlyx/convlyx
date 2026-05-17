import { Skeleton } from "@/components/ui/skeleton";

/**
 * Inner-content skeleton for list pages — rendered when filters/title are
 * already on screen and only the rows are still loading. Mirrors the row
 * shape used by ListPageSkeleton so the page-transition skeleton and the
 * data-fetch skeleton are visually continuous.
 */
export function CardListSkeleton({ rows = 6 }: { rows?: number } = {}) {
  return (
    <div className="grid gap-3 animate-in fade-in duration-300">
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
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
            <Skeleton className="h-3.5 w-72 max-w-full" />
          </div>
          <Skeleton className="h-4 w-4 shrink-0 mt-1" />
        </div>
      ))}
    </div>
  );
}

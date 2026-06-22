import { Skeleton } from "@/components/ui/skeleton";
import { LoadingAnnounce } from "@/components/loading-announce";

/** Matches the gradient hero card on student/instructor home pages. */
export function HeroCardSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-5 animate-in fade-in duration-300 space-y-3">
      <LoadingAnnounce />
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-6 w-2/3" />
      <div className="space-y-2 pt-1">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-2/5" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  );
}

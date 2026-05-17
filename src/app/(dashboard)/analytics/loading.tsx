import { Skeleton } from "@/components/ui/skeleton";
import { StatRowSkeleton } from "@/components/skeletons/stat-row-skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Skeleton className="h-8 w-32" />
      <StatRowSkeleton count={4} />
      <Skeleton className="h-72 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}

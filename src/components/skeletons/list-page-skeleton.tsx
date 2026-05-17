import { Skeleton } from "@/components/ui/skeleton";
import { CardListSkeleton } from "./card-list-skeleton";

export function ListPageSkeleton({
  rows = 6,
  filters = 3,
  showCreate = true,
}: {
  rows?: number;
  filters?: number;
  showCreate?: boolean;
} = {}) {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-8 w-40" />
        <div className="flex flex-wrap items-center gap-2">
          {Array.from({ length: filters }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-[130px]" />
          ))}
          <Skeleton className="h-9 w-[80px]" />
          {showCreate && <Skeleton className="h-9 w-[120px]" />}
        </div>
      </div>

      <CardListSkeleton rows={rows} />
    </div>
  );
}

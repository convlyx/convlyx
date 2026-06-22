import { Skeleton } from "@/components/ui/skeleton";
import { LoadingAnnounce } from "@/components/loading-announce";

export function SettingsSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <LoadingAnnounce />
      <Skeleton className="h-8 w-40" />

      {/* Tabs strip */}
      <div className="flex items-center gap-1 border-b">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>

      {/* One form-shaped section */}
      <section className="rounded-xl border bg-card p-5 card-shadow space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="grid gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
          <Skeleton className="h-9 w-24" />
        </div>
      </section>
    </div>
  );
}

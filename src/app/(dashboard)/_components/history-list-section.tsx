"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { BookOpen } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";

/**
 * Shared scaffold for the paginated history lists on user detail pages
 * (instructor class history, student enrollment history): heading, loading
 * skeleton, empty state, and pagination. Each caller supplies its own
 * per-item card via `renderItem` since the badges/meta differ.
 */
export function HistoryListSection<T>({
  title,
  isLoading,
  items,
  total,
  page,
  totalPages,
  onPageChange,
  renderItem,
  skeletonBadges = 2,
}: {
  title: string;
  isLoading: boolean;
  items: T[];
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  renderItem: (item: T) => React.ReactNode;
  skeletonBadges?: number;
}) {
  const t = useTranslations();
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {isLoading ? (
        <HistoryListSkeleton badges={skeletonBadges} />
      ) : items.length === 0 && total === 0 ? (
        <EmptyState icon={BookOpen} message={t("users.noHistory")} />
      ) : (
        <>
          <div className="space-y-2">{items.map((item) => renderItem(item))}</div>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={onPageChange}
          />
        </>
      )}
    </div>
  );
}

function HistoryListSkeleton({ badges }: { badges: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-lg border p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {Array.from({ length: badges }).map((_, j) => (
              <Skeleton
                key={j}
                className={`h-5 rounded-full ${
                  j === badges - 1 ? "w-20 ml-auto" : j === 0 ? "w-16" : "w-12"
                }`}
              />
            ))}
          </div>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

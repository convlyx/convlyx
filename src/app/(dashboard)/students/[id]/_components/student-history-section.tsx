"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations, useFormatter } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import {
  typeKeys,
  enrollmentStatusKeys,
  enrollmentStatusVariant,
  classTypeBadgeClass,
  resolveEnrollmentDisplay,
} from "@/lib/constants/class";
import { CategoryBadge } from "@/components/category-badge";
import { ITEMS_PER_PAGE as HISTORY_PER_PAGE } from "@/lib/constants/pagination";
import { HistoryListSection } from "@/app/(dashboard)/_components/history-list-section";

export function StudentHistorySection({ id }: { id: string }) {
  const t = useTranslations();
  const format = useFormatter();
  const [historyPage, setHistoryPage] = useState(1);

  const { data, isLoading } = trpc.user.studentEnrollments.useQuery({
    id,
    page: historyPage,
    pageSize: HISTORY_PER_PAGE,
  });

  const total = data?.total ?? 0;

  return (
    <HistoryListSection
      title={t("users.enrollmentHistory")}
      isLoading={isLoading || !data}
      items={data?.items ?? []}
      total={total}
      page={historyPage}
      totalPages={Math.max(1, Math.ceil(total / HISTORY_PER_PAGE))}
      onPageChange={setHistoryPage}
      skeletonBadges={3}
      renderItem={(enrollment) => {
        const displayStatus = resolveEnrollmentDisplay(
          enrollment.status,
          enrollment.session.status,
        );
        return (
          <Link
            key={enrollment.id}
            href={`/classes/${enrollment.session.id}`}
            className="block rounded-lg border p-3 transition-colors hover:bg-muted/50"
          >
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <Badge className={classTypeBadgeClass[enrollment.session.classType]}>
                {t(typeKeys[enrollment.session.classType])}
              </Badge>
              <CategoryBadge category={enrollment.session.category} />
              <Badge
                variant={enrollmentStatusVariant[displayStatus] ?? "outline"}
                className="ml-auto"
              >
                {t(enrollmentStatusKeys[displayStatus] ?? displayStatus)}
              </Badge>
            </div>
            <p className="text-sm font-medium truncate">{enrollment.session.title}</p>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mt-0.5">
              <span className="truncate">{enrollment.session.instructor.name}</span>
              <span className="shrink-0">
                {format.dateTime(new Date(enrollment.session.startsAt), {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </Link>
        );
      }}
    />
  );
}

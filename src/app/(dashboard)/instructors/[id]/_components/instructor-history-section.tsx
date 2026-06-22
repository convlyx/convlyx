"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations, useFormatter } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { typeKeys, statusKeys, statusVariant, classTypeBadgeClass } from "@/lib/constants/class";
import { ITEMS_PER_PAGE as HISTORY_PER_PAGE } from "@/lib/constants/pagination";
import { HistoryListSection } from "@/app/(dashboard)/_components/history-list-section";

export function InstructorHistorySection({ id }: { id: string }) {
  const t = useTranslations();
  const format = useFormatter();
  const [historyPage, setHistoryPage] = useState(1);

  const { data, isLoading } = trpc.user.instructorSessions.useQuery({
    id,
    page: historyPage,
    pageSize: HISTORY_PER_PAGE,
  });

  const total = data?.total ?? 0;

  return (
    <HistoryListSection
      title={t("users.classHistory")}
      isLoading={isLoading || !data}
      items={data?.items ?? []}
      total={total}
      page={historyPage}
      totalPages={Math.max(1, Math.ceil(total / HISTORY_PER_PAGE))}
      onPageChange={setHistoryPage}
      skeletonBadges={2}
      renderItem={(session) => (
        <Link
          key={session.id}
          href={`/classes/${session.id}`}
          className="block rounded-lg border p-3 transition-colors hover:bg-muted/50"
        >
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <Badge className={classTypeBadgeClass[session.classType]}>
              {t(typeKeys[session.classType])}
            </Badge>
            <Badge variant={statusVariant[session.status] ?? "outline"} className="ml-auto">
              {t(statusKeys[session.status] ?? session.status)}
            </Badge>
          </div>
          <p className="text-sm font-medium truncate">{session.title}</p>
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mt-0.5">
            <span className="truncate">
              {session._count.enrollments}/{session.capacity} {t("nav.students").toLowerCase()}
            </span>
            <span className="shrink-0">
              {format.dateTime(new Date(session.startsAt), {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </Link>
      )}
    />
  );
}

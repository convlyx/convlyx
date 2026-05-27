"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations, useFormatter } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { BookOpen } from "lucide-react";
import { typeKeys, statusKeys, statusVariant, classTypeBadgeClass } from "@/lib/constants/class";
import { ITEMS_PER_PAGE as HISTORY_PER_PAGE } from "@/lib/constants/pagination";

export function InstructorHistorySection({ id }: { id: string }) {
  const t = useTranslations();
  const format = useFormatter();
  const [historyPage, setHistoryPage] = useState(1);

  const { data, isLoading } = trpc.user.instructorSessions.useQuery({
    id,
    page: historyPage,
    pageSize: HISTORY_PER_PAGE,
  });

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">{t("users.classHistory")}</h2>
      {isLoading || !data ? (
        <InstructorHistorySkeleton />
      ) : data.items.length === 0 && data.total === 0 ? (
        <EmptyState icon={BookOpen} message={t("users.noHistory")} />
      ) : (
        <>
          <div className="space-y-2">
            {data.items.map((session) => (
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
            ))}
          </div>
          <Pagination
            page={historyPage}
            totalPages={Math.max(1, Math.ceil(data.total / HISTORY_PER_PAGE))}
            total={data.total}
            onPageChange={setHistoryPage}
          />
        </>
      )}
    </div>
  );
}

function InstructorHistorySkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-lg border p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full ml-auto" />
          </div>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

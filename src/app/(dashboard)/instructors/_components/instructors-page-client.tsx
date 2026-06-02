"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useUrlParam, useUrlParamInt, useDebouncedUrlParam } from "@/hooks/use-url-param";
import { trpc } from "@/lib/trpc";
import { keepPreviousData } from "@tanstack/react-query";
import Link from "next/link";
import { Users, ChevronRight, Search, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/radix-select";
import { EmptyState } from "@/components/empty-state";
import { UserAvatar } from "@/components/user-avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ViewToggle, useViewMode } from "@/components/view-toggle";
import { CardListSkeleton } from "@/components/skeletons/card-list-skeleton";
import { Pagination } from "@/components/pagination";
import { CreateUserDialog } from "@/app/(dashboard)/_components/create-user-dialog";
import { EditUserDialog } from "@/app/(dashboard)/_components/edit-user-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ITEMS_PER_PAGE } from "@/lib/constants/pagination";
import { roleColorMap } from "@/lib/constants/class";
import { toast } from "sonner";
import { useTranslatedError } from "@/hooks/use-translated-error";

export function InstructorsPageClient() {
  const t = useTranslations();
  const { onError } = useTranslatedError();
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();

  const initialView = (searchParams.get("view") as "cards" | "table") ?? undefined;
  const [view, setView] = useViewMode("/instructors", initialView);
  const [searchInput, search, setSearch] = useDebouncedUrlParam("search", "");
  const [statusFilter, setStatusFilter] = useUrlParam<"ACTIVE" | "INACTIVE" | "ALL">("status", "ACTIVE");
  const [page, setPage] = useUrlParamInt("page", 1);
  const [deactivateUserId, setDeactivateUserId] = useState<string | null>(null);

  const { data: usersData, isLoading, isFetching } = trpc.user.list.useQuery(
    {
      role: "INSTRUCTOR",
      ...(statusFilter !== "ALL" && { status: statusFilter }),
      ...(search.trim() && { search: search.trim() }),
      page,
      pageSize: ITEMS_PER_PAGE,
      includeAuthStatus: true,
    },
    // Keep current rows on screen (dimmed) while the next page loads, instead
    // of blanking to a skeleton.
    { placeholderData: keepPreviousData },
  );

  const paginatedUsers = usersData?.items ?? [];
  const total = usersData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  type InstructorRow = NonNullable<typeof usersData>["items"][number];
  const [editInstructor, setEditInstructor] = useState<InstructorRow | null>(null);

  const deactivateMutation = trpc.user.deactivate.useMutation({
    onSuccess: () => {
      toast.success(t("toast.userDeactivated"));
      utils.user.list.invalidate();
    },
    onError,
  });
  const activateMutation = trpc.user.activate.useMutation({
    onSuccess: () => {
      toast.success(t("toast.userActivated"));
      utils.user.list.invalidate();
    },
    onError,
  });

  useEffect(() => {
    if (page !== 1) setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  function handleViewChange(mode: "cards" | "table") {
    setView(mode);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">{t("nav.instructors")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[140px] sm:flex-none">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("common.search") + "..."}
              value={searchInput}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full sm:w-[200px]"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "ACTIVE" | "INACTIVE" | "ALL")}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">{t("common.active")}</SelectItem>
              <SelectItem value="INACTIVE">{t("common.inactive")}</SelectItem>
              <SelectItem value="ALL">{t("common.all")}</SelectItem>
            </SelectContent>
          </Select>
          <ViewToggle view={view} onChange={handleViewChange} />
          <CreateUserDialog fixedRole="INSTRUCTOR" buttonLabel={t("users.createInstructor")} />
        </div>
      </div>

      {isLoading ? (
        <CardListSkeleton />
      ) : total === 0 ? (
        <EmptyState icon={Users} message={t("common.noResults")} />
      ) : view === "cards" ? (
        <div className={`grid gap-3 animate-in fade-in duration-300 ${isFetching ? "opacity-60 transition-opacity" : ""}`}>
          {paginatedUsers.map((instructor) => (
            <Link
              key={instructor.id}
              href={`/instructors/${instructor.id}`}
              className="rounded-xl border bg-card p-4 card-shadow hover:card-shadow-hover transition-all hover:border-primary/20 group block"
            >
              <div className="flex items-start gap-3">
                <UserAvatar name={instructor.name} className={`h-10 w-10 sm:h-11 sm:w-11 ${roleColorMap.INSTRUCTOR} shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-medium group-hover:text-primary transition-colors truncate min-w-0">{instructor.name}</p>
                    <Badge variant={instructor.status === "ACTIVE" ? "default" : "destructive"}>
                      {instructor.status === "ACTIVE" ? t("common.active") : t("common.inactive")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-0.5">{instructor.email}</p>
                  {!instructor.anonymized && (
                    <div className="mt-2 flex gap-2 sm:hidden">
                      <Button variant="outline" size="sm" onClick={(e) => { e.preventDefault(); setEditInstructor(instructor); }}>
                        <Pencil className="h-3.5 w-3.5 mr-1" />{t("common.edit")}
                      </Button>
                      {instructor.status === "ACTIVE" ? (
                        <Button variant="destructive" size="sm" className="flex-1" disabled={deactivateMutation.isPending} onClick={(e) => { e.preventDefault(); setDeactivateUserId(instructor.id); }}>
                          {t("users.deactivate")}
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" className="flex-1" disabled={activateMutation.isPending} onClick={(e) => { e.preventDefault(); activateMutation.mutate({ id: instructor.id }); }}>
                          {t("users.activate")}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                {instructor.anonymized ? (
                  <ChevronRight className="hidden sm:block h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                ) : (
                  <div className="hidden sm:flex shrink-0 gap-1 items-center">
                    <Button variant="outline" size="icon-sm" onClick={(e) => { e.preventDefault(); setEditInstructor(instructor); }} title={t("common.edit")}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {instructor.status === "ACTIVE" ? (
                      <Button variant="destructive" size="sm" disabled={deactivateMutation.isPending} onClick={(e) => { e.preventDefault(); setDeactivateUserId(instructor.id); }}>
                        {t("users.deactivate")}
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" disabled={activateMutation.isPending} onClick={(e) => { e.preventDefault(); activateMutation.mutate({ id: instructor.id }); }}>
                        {t("users.activate")}
                      </Button>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors ml-1" />
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className={`rounded-xl border card-shadow overflow-hidden animate-in fade-in duration-300 ${isFetching ? "opacity-60 transition-opacity" : ""}`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("auth.email")}</TableHead>
                <TableHead>{t("common.school")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUsers.map((instructor) => (
                <TableRow key={instructor.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell>
                    <Link href={`/instructors/${instructor.id}`} className="font-medium text-primary hover:underline">
                      {instructor.name}
                    </Link>
                  </TableCell>
                  <TableCell>{instructor.email}</TableCell>
                  <TableCell>{instructor.school.name}</TableCell>
                  <TableCell>
                    <Badge variant={instructor.status === "ACTIVE" ? "default" : "destructive"}>
                      {instructor.status === "ACTIVE" ? t("common.active") : t("common.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {instructor.anonymized ? null : (
                      <div className="flex gap-1">
                        <Button variant="outline" size="icon-sm" onClick={() => setEditInstructor(instructor)} title={t("common.edit")}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {instructor.status === "ACTIVE" ? (
                          <Button variant="destructive" size="sm" disabled={deactivateMutation.isPending} onClick={() => setDeactivateUserId(instructor.id)}>
                            {t("users.deactivate")}
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" disabled={activateMutation.isPending} onClick={() => activateMutation.mutate({ id: instructor.id })}>
                            {t("users.activate")}
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
      />

      {editInstructor && (
        <EditUserDialog
          userData={editInstructor}
          open={editInstructor !== null}
          onClose={() => setEditInstructor(null)}
        />
      )}

      <ConfirmDialog
        open={deactivateUserId !== null}
        onClose={() => setDeactivateUserId(null)}
        onConfirm={() => {
          if (deactivateUserId) deactivateMutation.mutate({ id: deactivateUserId });
          setDeactivateUserId(null);
        }}
        title={t("users.deactivateTitle")}
        message={t("users.deactivateMessage")}
        loading={deactivateMutation.isPending}
      />
    </div>
  );
}

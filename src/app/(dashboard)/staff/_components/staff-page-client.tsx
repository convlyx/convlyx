"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useUrlParam, useUrlParamInt, useDebouncedUrlParam } from "@/hooks/use-url-param";
import { trpc } from "@/lib/trpc";
import { keepPreviousData } from "@tanstack/react-query";
import { UserCog, Search, Pencil, Phone, BadgeCheck, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/radix-select";
import { ViewToggle, useViewMode } from "@/components/view-toggle";
import { CardListSkeleton } from "@/components/skeletons/card-list-skeleton";
import { DataTableCard } from "@/components/data-table-card";
import { EmptyState } from "@/components/empty-state";
import { UserAvatar } from "@/components/user-avatar";
import { roleColorMap } from "@/lib/constants/class";
import { Pagination } from "@/components/pagination";
import { CreateUserDialog } from "@/app/(dashboard)/_components/create-user-dialog";
import { EditUserDialog } from "@/app/(dashboard)/_components/edit-user-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";
import { useTranslatedError } from "@/hooks/use-translated-error";
import { ITEMS_PER_PAGE } from "@/lib/constants/pagination";

const STAFF_ROLES = ["ADMIN", "SECRETARY"] as const;

export function StaffPageClient() {
  const t = useTranslations();
  const { onError } = useTranslatedError();
  const searchParams = useSearchParams();

  const initialView = (searchParams.get("view") as "cards" | "table") ?? undefined;
  const [view, setView] = useViewMode("/staff", initialView);
  const [searchInput, search, setSearch] = useDebouncedUrlParam("search", "");
  const [roleFilter, setRoleFilter] = useUrlParam<string>("role", "ALL");
  const [page, setPage] = useUrlParamInt("page", 1);
  const [deactivateUserId, setDeactivateUserId] = useState<string | null>(null);

  const { data: usersData, isLoading, isFetching } = trpc.user.list.useQuery(
    {
      ...(roleFilter !== "ALL"
        ? { role: roleFilter as typeof STAFF_ROLES[number] }
        : { roles: [...STAFF_ROLES] }),
      ...(search.trim() && { search: search.trim() }),
      page,
      pageSize: ITEMS_PER_PAGE,
      includeAuthStatus: true,
    },
    // Keep current rows on screen (dimmed) while the next page loads, instead
    // of blanking to a skeleton.
    { placeholderData: keepPreviousData },
  );
  const users = usersData?.items ?? [];
  const total = usersData?.total ?? 0;

  type UserRow = NonNullable<typeof usersData>["items"][number];
  const [editUser, setEditUser] = useState<UserRow | null>(null);

  const utils = trpc.useUtils();
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

  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  useEffect(() => {
    if (page !== 1) setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter]);

  function handleViewChange(mode: "cards" | "table") {
    setView(mode);
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t("nav.staff")}>
        <div className="relative flex-1 min-w-[140px] sm:flex-none">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("common.search") + "..."}
            aria-label={t("common.search")}
            value={searchInput}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-full sm:w-[200px]"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-auto min-w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("users.allRoles")}</SelectItem>
            {STAFF_ROLES.map((role) => (
              <SelectItem key={role} value={role}>{t(`roles.${role}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ViewToggle view={view} onChange={handleViewChange} />
        <CreateUserDialog
          allowedRoles={STAFF_ROLES}
          buttonLabel={t("staff.create")}
        />
      </PageHeader>

      {isLoading ? (
        <CardListSkeleton />
      ) : total === 0 ? (
        <EmptyState icon={UserCog} message={t("staff.noStaff")} />
      ) : view === "cards" ? (
        <div className={`grid gap-3 animate-in fade-in duration-300 ${isFetching ? "opacity-60 transition-opacity" : ""}`}>
          {users.map((user) => (
            <div key={user.id} className="rounded-xl border bg-card p-4 card-shadow hover:card-shadow-hover transition-all">
              <div className="flex items-center gap-3">
                <UserAvatar name={user.name} className={`h-10 w-10 sm:h-11 sm:w-11 shrink-0 ${roleColorMap[user.role] ?? "bg-muted text-foreground"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-medium truncate min-w-0">{user.name}</p>
                    <Badge variant="secondary">{t(`roles.${user.role}`)}</Badge>
                    {user.status !== "ACTIVE" && <Badge variant="destructive">{t("common.inactive")}</Badge>}
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm text-muted-foreground mt-0.5 min-w-0">
                    <span className="flex items-center gap-1 truncate min-w-0">
                      {user.emailConfirmed ? (
                        <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-success" aria-label={t("users.emailConfirmed")} />
                      ) : (
                        <Clock className="h-3.5 w-3.5 shrink-0 text-warning" aria-label={t("users.emailPending")} />
                      )}
                      <span className="truncate">{user.email}</span>
                    </span>
                    {user.phone && <span className="flex items-center gap-1 truncate min-w-0"><Phone className="h-3.5 w-3.5 shrink-0" />{user.phone}</span>}
                  </div>
                  <div className="mt-2 flex gap-2 sm:hidden">
                    <Button variant="outline" size="sm" onClick={() => setEditUser(user)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />{t("common.edit")}
                    </Button>
                    {user.status === "ACTIVE" ? (
                      <Button variant="destructive" size="sm" className="flex-1" disabled={deactivateMutation.isPending} onClick={() => setDeactivateUserId(user.id)}>
                        {t("users.deactivate")}
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="flex-1" disabled={activateMutation.isPending} onClick={() => activateMutation.mutate({ id: user.id })}>
                        {t("users.activate")}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="hidden sm:flex shrink-0 gap-1">
                  <Button variant="outline" size="icon-sm" onClick={() => setEditUser(user)} title={t("common.edit")}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {user.status === "ACTIVE" ? (
                    <Button variant="destructive" size="sm" disabled={deactivateMutation.isPending} onClick={() => setDeactivateUserId(user.id)}>
                      {t("users.deactivate")}
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled={activateMutation.isPending} onClick={() => activateMutation.mutate({ id: user.id })}>
                      {t("users.activate")}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <DataTableCard className={`animate-in fade-in duration-300 ${isFetching ? "opacity-60 transition-opacity" : ""}`}>
          <Table>
            <caption className="sr-only">{t("nav.staff")}</caption>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("auth.email")}</TableHead>
                <TableHead>{t("common.role")}</TableHead>
                <TableHead>{t("common.school")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      {user.emailConfirmed ? (
                        <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-success" aria-label={t("users.emailConfirmed")} />
                      ) : (
                        <Clock className="h-3.5 w-3.5 shrink-0 text-warning" aria-label={t("users.emailPending")} />
                      )}
                      {user.email}
                    </span>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{t(`roles.${user.role}`)}</Badge></TableCell>
                  <TableCell>{user.school.name}</TableCell>
                  <TableCell>
                    <Badge variant={user.status === "ACTIVE" ? "default" : "destructive"}>
                      {user.status === "ACTIVE" ? t("common.active") : t("common.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="outline" size="icon-sm" onClick={() => setEditUser(user)} title={t("common.edit")}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {user.status === "ACTIVE" ? (
                        <Button variant="destructive" size="sm" disabled={deactivateMutation.isPending} onClick={() => setDeactivateUserId(user.id)}>
                          {t("users.deactivate")}
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" disabled={activateMutation.isPending} onClick={() => activateMutation.mutate({ id: user.id })}>
                          {t("users.activate")}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableCard>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
      />

      {editUser && (
        <EditUserDialog
          userData={editUser}
          open={editUser !== null}
          onClose={() => setEditUser(null)}
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

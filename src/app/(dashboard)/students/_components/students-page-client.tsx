"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useUrlParam, useUrlParamInt } from "@/hooks/use-url-param";
import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { GraduationCap, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/radix-select";
import { EmptyState } from "@/components/empty-state";
import { UserAvatar } from "@/components/user-avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ViewToggle, useViewMode } from "@/components/view-toggle";
import { Loading } from "@/components/loading";
import { Pagination } from "@/components/pagination";
import { CreateUserDialog } from "@/app/(dashboard)/users/_components/create-user-dialog";
import { CategoryBadge } from "@/components/category-badge";
import { ITEMS_PER_PAGE } from "@/lib/constants/pagination";
import { roleColorMap } from "@/lib/constants/class";

import type { UserRole } from "@/generated/prisma/enums";

export function StudentsPageClient({ userRole }: { userRole: UserRole }) {
  const canCreate = userRole === "ADMIN" || userRole === "SECRETARY";
  const t = useTranslations();
  const searchParams = useSearchParams();

  const initialView = (searchParams.get("view") as "cards" | "table") ?? undefined;
  const [view, setView] = useViewMode("/students", initialView);
  const [search, setSearch] = useUrlParam<string>("search", "");
  const [statusFilter, setStatusFilter] = useUrlParam<"ACTIVE" | "INACTIVE" | "ALL">("status", "ACTIVE");
  const [page, setPage] = useUrlParamInt("page", 1);

  const { data: usersData, isLoading } = trpc.user.list.useQuery({
    role: "STUDENT",
    ...(statusFilter !== "ALL" && { status: statusFilter }),
    ...(search.trim() && { search: search.trim() }),
    page,
    pageSize: ITEMS_PER_PAGE,
  });

  const paginatedUsers = usersData?.items ?? [];
  const total = usersData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  // Reset to page 1 whenever a filter narrows the result set, so the user
  // doesn't get stuck on an empty page N.
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
        <h1 className="text-2xl font-bold">{t("nav.students")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[140px] sm:flex-none">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("common.search") + "..."}
              value={search}
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
          {canCreate && <CreateUserDialog fixedRole="STUDENT" buttonLabel={t("users.createStudent")} />}
        </div>
      </div>

      {isLoading ? (
        <Loading />
      ) : total === 0 ? (
        <EmptyState icon={GraduationCap} message={t("common.noResults")} />
      ) : view === "cards" ? (
        <div className="grid gap-3">
          {paginatedUsers.map((student) => (
            <Link
              key={student.id}
              href={`/students/${student.id}`}
              className="rounded-xl border bg-card p-4 card-shadow hover:card-shadow-hover transition-all hover:border-primary/20 group block"
            >
              <div className="flex items-start gap-3">
                <UserAvatar name={student.name} className={`h-10 w-10 sm:h-11 sm:w-11 ${roleColorMap.STUDENT} shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-medium group-hover:text-primary transition-colors truncate min-w-0">{student.name}</p>
                    <CategoryBadge category={student.currentCategory} />
                    <Badge variant={student.status === "ACTIVE" ? "default" : "destructive"}>
                      {student.status === "ACTIVE" ? t("common.active") : t("common.inactive")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-0.5">{student.email}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border card-shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("auth.email")}</TableHead>
                <TableHead>{t("common.school")}</TableHead>
                <TableHead>{t("classes.category")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUsers.map((student) => (
                <TableRow key={student.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell>
                    <Link href={`/students/${student.id}`} className="font-medium text-primary hover:underline">
                      {student.name}
                    </Link>
                  </TableCell>
                  <TableCell>{student.email}</TableCell>
                  <TableCell>{student.school.name}</TableCell>
                  <TableCell><CategoryBadge category={student.currentCategory} /></TableCell>
                  <TableCell>
                    <Badge variant={student.status === "ACTIVE" ? "default" : "destructive"}>
                      {student.status === "ACTIVE" ? t("common.active") : t("common.inactive")}
                    </Badge>
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
    </div>
  );
}

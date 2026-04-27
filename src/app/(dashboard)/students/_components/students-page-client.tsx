"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
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
const ITEMS_PER_PAGE = 10;

import type { UserRole } from "@/generated/prisma/enums";

export function StudentsPageClient({ userRole }: { userRole: UserRole }) {
  const canCreate = userRole === "ADMIN" || userRole === "SECRETARY";
  const t = useTranslations();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  function updateParams(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "" || value === "cards") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const initialView = (searchParams.get("view") as "cards" | "table") ?? undefined;
  const [view, setView] = useViewMode("/students", initialView);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "INACTIVE" | "ALL">(
    (searchParams.get("status") as "ACTIVE" | "INACTIVE" | "ALL") ?? "ACTIVE"
  );
  const [page, setPage] = useState(1);
  const { data: users, isLoading } = trpc.user.list.useQuery({
    role: "STUDENT",
    ...(statusFilter !== "ALL" && { status: statusFilter }),
  });

  const filteredUsers = users?.filter((user) =>
    user.name.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = filteredUsers.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => setPage(1), [search, statusFilter]);

  function handleSearchChange(value: string) {
    setSearch(value);
    updateParams("search", value);
  }

  function handleStatusChange(value: "ACTIVE" | "INACTIVE" | "ALL") {
    setStatusFilter(value);
    updateParams("status", value === "ACTIVE" ? "" : value);
  }

  function handleViewChange(mode: "cards" | "table") {
    setView(mode);
    updateParams("view", mode);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">{t("nav.students")}</h1>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("common.search") + "..."}
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 w-full sm:w-[200px]"
            />
          </div>
          <Select value={statusFilter} onValueChange={handleStatusChange}>
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
      ) : filteredUsers.length === 0 ? (
        <EmptyState icon={GraduationCap} message={t("common.noResults")} />
      ) : view === "cards" ? (
        <div className="grid gap-3">
          {paginatedUsers.map((student) => (
            <Link
              key={student.id}
              href={`/students/${student.id}`}
              className="rounded-xl border bg-card p-4 card-shadow hover:card-shadow-hover transition-all hover:border-primary/20 group block"
            >
              <div className="flex items-center gap-3">
                <UserAvatar name={student.name} className="h-10 w-10 sm:h-11 sm:w-11 bg-primary/10 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium group-hover:text-primary transition-colors truncate">{student.name}</p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 ml-auto sm:ml-0" />
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{student.email}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <Badge variant="secondary">{student.school.name}</Badge>
                    <Badge variant={student.status === "ACTIVE" ? "default" : "destructive"}>
                      {student.status === "ACTIVE" ? t("common.active") : t("common.inactive")}
                    </Badge>
                  </div>
                </div>
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
        total={filteredUsers.length}
        onPageChange={setPage}
      />
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { Users, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

export function InstructorsPageClient() {
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
  const [view, setView] = useViewMode("/instructors", initialView);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [page, setPage] = useState(1);
  const { data: users, isLoading } = trpc.user.list.useQuery({ role: "INSTRUCTOR" });

  const filteredUsers = users?.filter((user) =>
    user.name.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = filteredUsers.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => setPage(1), [search]);

  function handleSearchChange(value: string) {
    setSearch(value);
    updateParams("search", value);
  }

  function handleViewChange(mode: "cards" | "table") {
    setView(mode);
    updateParams("view", mode);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">{t("nav.instructors")}</h1>
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
          <ViewToggle view={view} onChange={handleViewChange} />
          <CreateUserDialog fixedRole="INSTRUCTOR" buttonLabel={t("users.createInstructor")} />
        </div>
      </div>

      {isLoading ? (
        <Loading />
      ) : filteredUsers.length === 0 ? (
        <EmptyState icon={Users} message={t("common.noResults")} />
      ) : view === "cards" ? (
        <div className="grid gap-3">
          {paginatedUsers.map((instructor) => (
            <Link
              key={instructor.id}
              href={`/instructors/${instructor.id}`}
              className="rounded-xl border bg-card p-4 card-shadow hover:card-shadow-hover transition-all hover:border-primary/20 group block"
            >
              <div className="flex items-center gap-3">
                <UserAvatar name={instructor.name} className="h-10 w-10 sm:h-11 sm:w-11 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium group-hover:text-primary transition-colors truncate">{instructor.name}</p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 ml-auto sm:ml-0" />
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{instructor.email}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <Badge variant="secondary">{instructor.school.name}</Badge>
                    <Badge variant={instructor.status === "ACTIVE" ? "default" : "destructive"}>
                      {instructor.status === "ACTIVE" ? t("common.active") : t("common.inactive")}
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

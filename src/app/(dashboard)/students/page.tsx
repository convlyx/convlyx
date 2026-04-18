"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { GraduationCap, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { UserAvatar } from "@/components/user-avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ViewToggle, useViewMode } from "@/components/view-toggle";
import { Loading } from "@/components/loading";

export default function StudentsPage() {
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
  const { data: users, isLoading } = trpc.user.list.useQuery({ role: "STUDENT" });

  const filteredUsers = users?.filter((user) =>
    user.name.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

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
          <ViewToggle view={view} onChange={handleViewChange} />
        </div>
      </div>

      {isLoading ? (
        <Loading />
      ) : filteredUsers.length === 0 ? (
        <EmptyState icon={GraduationCap} message={t("common.noResults")} />
      ) : view === "cards" ? (
        <div className="grid gap-3">
          {filteredUsers.map((student) => (
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
              {filteredUsers.map((student) => (
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
    </div>
  );
}

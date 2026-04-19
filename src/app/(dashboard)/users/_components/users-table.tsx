"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Users, Mail, Building2, Search, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/radix-select";
import { ViewToggle, useViewMode } from "@/components/view-toggle";
import { Loading } from "@/components/loading";
import { EmptyState } from "@/components/empty-state";
import { UserAvatar } from "@/components/user-avatar";
import { roleColorMap } from "@/lib/constants/class";
import { EditUserDialog } from "./edit-user-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";
import type { UserRole } from "@/generated/prisma/enums";

const ROLES = ["ADMIN", "SECRETARY", "INSTRUCTOR", "STUDENT"] as const;

export function UsersTable({ userRole }: { userRole: UserRole }) {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  function updateParams(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "ALL" || value === "" || value === "cards") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const initialView = (searchParams.get("view") as "cards" | "table") ?? undefined;
  const [view, setView] = useViewMode("/users", initialView);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [roleFilter, setRoleFilter] = useState<string>(searchParams.get("role") ?? "ALL");
  const [schoolFilter, setSchoolFilter] = useState<string>(searchParams.get("school") ?? "ALL");
  const [editUser, setEditUser] = useState<typeof filteredUsers[number] | null>(null);
  const [deactivateUserId, setDeactivateUserId] = useState<string | null>(null);

  const { data: schools } = trpc.school.list.useQuery();

  // Auto-select when only one school
  useEffect(() => {
    if (schoolFilter === "ALL" && schools?.length === 1) {
      handleSchoolChange(schools[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schools]);

  const { data: users, isLoading } = trpc.user.list.useQuery({
    ...(roleFilter !== "ALL" && { role: roleFilter as typeof ROLES[number] }),
    ...(schoolFilter !== "ALL" && { schoolId: schoolFilter }),
  });

  const utils = trpc.useUtils();
  const deactivateMutation = trpc.user.deactivate.useMutation({
    onSuccess: () => {
      toast.success("Utilizador desativado");
      utils.user.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  const activateMutation = trpc.user.activate.useMutation({
    onSuccess: () => {
      toast.success("Utilizador ativado");
      utils.user.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const canDeactivate = userRole === "ADMIN";

  const filteredUsers = users?.filter((user) =>
    user.name.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  function handleSearchChange(value: string) {
    setSearch(value);
    updateParams("search", value);
  }

  function handleRoleChange(value: string) {
    setRoleFilter(value);
    updateParams("role", value);
  }

  function handleSchoolChange(value: string) {
    setSchoolFilter(value);
    updateParams("school", value);
  }

  function handleViewChange(mode: "cards" | "table") {
    setView(mode);
    updateParams("view", mode);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("common.search") + "..."}
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 w-full sm:w-[200px]"
            />
          </div>
          <Select value={roleFilter} onValueChange={handleRoleChange}>
            <SelectTrigger className="w-auto min-w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("users.allRoles")}</SelectItem>
              {ROLES.map((role) => (
                <SelectItem key={role} value={role}>{t(`roles.${role}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={schoolFilter} onValueChange={handleSchoolChange}>
            <SelectTrigger className="w-auto min-w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("schools.allSchools")}</SelectItem>
              {schools?.map((school) => (
                <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ViewToggle view={view} onChange={handleViewChange} />
      </div>

      {isLoading ? (
        <Loading />
      ) : filteredUsers.length === 0 ? (
        <EmptyState icon={Users} message={t("users.noUsers")} />
      ) : view === "cards" ? (
        <div className="grid gap-3">
          {filteredUsers.map((user) => (
            <div key={user.id} className="rounded-xl border bg-card p-4 card-shadow hover:card-shadow-hover transition-all">
              <div className="flex items-center gap-3">
                <UserAvatar name={user.name} className={`h-10 w-10 sm:h-11 sm:w-11 shrink-0 ${roleColorMap[user.role] ?? "bg-muted text-foreground"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-medium truncate">{user.name}</p>
                    <Badge variant="secondary">{t(`roles.${user.role}`)}</Badge>
                    {user.status !== "ACTIVE" && <Badge variant="destructive">{t("common.inactive")}</Badge>}
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1 truncate"><Mail className="h-3.5 w-3.5 shrink-0" />{user.email}</span>
                    <span className="flex items-center gap-1 truncate"><Building2 className="h-3.5 w-3.5 shrink-0" />{user.school.name}</span>
                  </div>
                  <div className="mt-2 flex gap-2 sm:hidden">
                    <Button variant="outline" size="sm" onClick={() => setEditUser(user)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />{t("common.edit")}
                    </Button>
                    {canDeactivate && (user.status === "ACTIVE" ? (
                      <Button variant="destructive" size="sm" className="flex-1" disabled={deactivateMutation.isPending} onClick={() => setDeactivateUserId(user.id)}>
                        {t("users.deactivate")}
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="flex-1" disabled={activateMutation.isPending} onClick={() => activateMutation.mutate({ id: user.id })}>
                        {t("users.activate")}
                      </Button>
                    ))}
                  </div>
                </div>
                {/* Desktop action buttons */}
                <div className="hidden sm:flex shrink-0 gap-1">
                  <Button variant="outline" size="icon-sm" onClick={() => setEditUser(user)} title={t("common.edit")}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {canDeactivate && (user.status === "ACTIVE" ? (
                    <Button variant="destructive" size="sm" disabled={deactivateMutation.isPending} onClick={() => setDeactivateUserId(user.id)}>
                      {t("users.deactivate")}
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled={activateMutation.isPending} onClick={() => activateMutation.mutate({ id: user.id })}>
                      {t("users.activate")}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border card-shadow overflow-hidden">
          <Table>
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
              {filteredUsers.map((user) => (
                <TableRow key={user.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
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
                      {canDeactivate && (user.status === "ACTIVE" ? (
                        <Button variant="destructive" size="sm" disabled={deactivateMutation.isPending} onClick={() => setDeactivateUserId(user.id)}>
                          {t("users.deactivate")}
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" disabled={activateMutation.isPending} onClick={() => activateMutation.mutate({ id: user.id })}>
                          {t("users.activate")}
                        </Button>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

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
        title="Desativar utilizador"
        message="Tem a certeza que pretende desativar este utilizador?"
        loading={deactivateMutation.isPending}
      />
    </div>
  );
}

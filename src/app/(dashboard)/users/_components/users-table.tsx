"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Users, Mail, Building2 } from "lucide-react";
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

const ROLES = ["ADMIN", "SECRETARY", "INSTRUCTOR", "STUDENT"] as const;

const roleColorMap: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  SECRETARY: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  INSTRUCTOR: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  STUDENT: "bg-primary/10 text-primary",
};

export function UsersTable() {
  const t = useTranslations();
  const [view, setView] = useViewMode("/users");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [schoolFilter, setSchoolFilter] = useState<string>("ALL");

  const { data: schools } = trpc.school.list.useQuery();
  const { data: users, isLoading } = trpc.user.list.useQuery({
    ...(roleFilter !== "ALL" && { role: roleFilter as typeof ROLES[number] }),
    ...(schoolFilter !== "ALL" && { schoolId: schoolFilter }),
  });

  const utils = trpc.useUtils();
  const deactivateMutation = trpc.user.deactivate.useMutation({
    onSuccess: () => utils.user.list.invalidate(),
  });
  const activateMutation = trpc.user.activate.useMutation({
    onSuccess: () => utils.user.list.invalidate(),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("users.allRoles")}</SelectItem>
              {ROLES.map((role) => (
                <SelectItem key={role} value={role}>{t(`roles.${role}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={schoolFilter} onValueChange={setSchoolFilter}>
            <SelectTrigger className="w-[200px]">
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
        <ViewToggle view={view} onChange={setView} />
      </div>

      {isLoading ? (
        <Loading />
      ) : !users || users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">{t("users.noUsers")}</p>
        </div>
      ) : view === "cards" ? (
        <div className="grid gap-3">
          {users.map((user) => (
            <div key={user.id} className="flex items-center justify-between rounded-xl border bg-card p-4 card-shadow hover:card-shadow-hover transition-all">
              <div className="flex items-center gap-4">
                <div className={`flex h-11 w-11 items-center justify-center rounded-full font-semibold text-sm ${roleColorMap[user.role] ?? "bg-muted text-foreground"}`}>
                  {user.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{user.name}</p>
                    <Badge variant="secondary">{t(`roles.${user.role}`)}</Badge>
                    {user.status !== "ACTIVE" && <Badge variant="destructive">{t("common.inactive")}</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{user.email}</span>
                    <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{user.school.name}</span>
                  </div>
                </div>
              </div>
              {user.status === "ACTIVE" ? (
                <Button variant="destructive" size="sm" disabled={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate({ id: user.id })}>
                  {t("users.deactivate")}
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled={activateMutation.isPending} onClick={() => activateMutation.mutate({ id: user.id })}>
                  {t("users.activate")}
                </Button>
              )}
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
              {users.map((user) => (
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
                    {user.status === "ACTIVE" ? (
                      <Button variant="destructive" size="sm" disabled={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate({ id: user.id })}>
                        {t("users.deactivate")}
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" disabled={activateMutation.isPending} onClick={() => activateMutation.mutate({ id: user.id })}>
                        {t("users.activate")}
                      </Button>
                    )}
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

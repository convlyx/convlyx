"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/radix-select";

const ROLES = ["ADMIN", "SECRETARY", "INSTRUCTOR", "STUDENT"] as const;

export function UsersTable() {
  const t = useTranslations();
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
      <div className="flex items-center gap-3">
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("common.role")}: {t("common.filter")}</SelectItem>
            {ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {t(`roles.${role}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={schoolFilter} onValueChange={setSchoolFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("common.school")}: {t("common.filter")}</SelectItem>
            {schools?.map((school) => (
              <SelectItem key={school.id} value={school.id}>
                {school.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : !users || users.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("users.noUsers")}</p>
      ) : (
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
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{t(`roles.${user.role}`)}</Badge>
                </TableCell>
                <TableCell>{user.school.name}</TableCell>
                <TableCell>
                  <Badge variant={user.status === "ACTIVE" ? "default" : "destructive"}>
                    {user.status === "ACTIVE" ? t("common.active") : t("common.inactive")}
                  </Badge>
                </TableCell>
                <TableCell>
                  {user.status === "ACTIVE" ? (
                    <Button
                      variant="destructive" size="sm"
                      disabled={deactivateMutation.isPending}
                      onClick={() => deactivateMutation.mutate({ id: user.id })}
                    >
                      {t("users.deactivate")}
                    </Button>
                  ) : (
                    <Button
                      variant="outline" size="sm"
                      disabled={activateMutation.isPending}
                      onClick={() => activateMutation.mutate({ id: user.id })}
                    >
                      {t("users.activate")}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

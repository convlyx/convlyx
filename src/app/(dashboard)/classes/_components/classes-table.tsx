"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { trpc } from "@/lib/trpc";
import { BookOpen, Clock, Users, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/radix-select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ViewToggle, useViewMode } from "@/components/view-toggle";
import { Loading } from "@/components/loading";

function classStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "SCHEDULED": return "outline";
    case "IN_PROGRESS": return "default";
    case "COMPLETED": return "secondary";
    case "CANCELLED": return "destructive";
    default: return "outline";
  }
}

const statusKeys: Record<string, string> = {
  SCHEDULED: "classes.scheduled",
  IN_PROGRESS: "classes.inProgress",
  COMPLETED: "classes.completed",
  CANCELLED: "classes.cancelled",
};

const typeKeys: Record<string, string> = {
  THEORY: "classes.theory",
  PRACTICAL: "classes.practical",
};

export function ClassesTable() {
  const t = useTranslations();
  const format = useFormatter();
  const [view, setView] = useViewMode("/classes");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [schoolFilter, setSchoolFilter] = useState<string>("ALL");
  const [cancelId, setCancelId] = useState<string | null>(null);

  const { data: schools } = trpc.school.list.useQuery();
  const { data: classes, isLoading } = trpc.class.list.useQuery({
    ...(typeFilter !== "ALL" && { classType: typeFilter as "THEORY" | "PRACTICAL" }),
    ...(schoolFilter !== "ALL" && { schoolId: schoolFilter }),
  });

  const utils = trpc.useUtils();
  const cancelMutation = trpc.class.cancel.useMutation({
    onSuccess: () => {
      utils.class.list.invalidate();
      setCancelId(null);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("classes.allTypes")}</SelectItem>
              <SelectItem value="THEORY">{t("classes.theory")}</SelectItem>
              <SelectItem value="PRACTICAL">{t("classes.practical")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={schoolFilter} onValueChange={setSchoolFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("schools.allSchools")}</SelectItem>
              {schools?.map((school) => (
                <SelectItem key={school.id} value={school.id}>
                  {school.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ViewToggle view={view} onChange={setView} />
      </div>

      {isLoading ? (
        <Loading />
      ) : !classes || classes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <BookOpen className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">{t("classes.noClasses")}</p>
        </div>
      ) : view === "cards" ? (
        <div className="grid gap-3">
          {classes.map((cls) => (
            <div
              key={cls.id}
              className="rounded-xl border bg-card p-4 card-shadow hover:card-shadow-hover transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    cls.classType === "THEORY"
                      ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                      : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                  }`}>
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{cls.title}</p>
                      <Badge variant="secondary">{t(typeKeys[cls.classType])}</Badge>
                      <Badge variant={classStatusVariant(cls.status)}>{t(statusKeys[cls.status])}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{cls.instructor.name}</span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {format.dateTime(new Date(cls.startsAt), { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        {" · "}
                        {format.dateTime(new Date(cls.endsAt), { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{cls._count.enrollments}/{cls.capacity}</span>
                    </div>
                  </div>
                </div>
                {cls.status !== "COMPLETED" && cls.status !== "CANCELLED" && (
                  <Button variant="destructive" size="sm" onClick={() => setCancelId(cls.id)}>{t("common.cancel")}</Button>
                )}
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
                <TableHead>{t("classes.type")}</TableHead>
                <TableHead>{t("classes.instructor")}</TableHead>
                <TableHead>{t("classes.date")}</TableHead>
                <TableHead>{t("classes.capacity")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.map((cls) => (
                <TableRow key={cls.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium">{cls.title}</TableCell>
                  <TableCell><Badge variant="secondary">{t(typeKeys[cls.classType])}</Badge></TableCell>
                  <TableCell>{cls.instructor.name}</TableCell>
                  <TableCell>
                    {format.dateTime(new Date(cls.startsAt), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    {format.dateTime(new Date(cls.endsAt), { hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell>{cls._count.enrollments}/{cls.capacity}</TableCell>
                  <TableCell><Badge variant={classStatusVariant(cls.status)}>{t(statusKeys[cls.status])}</Badge></TableCell>
                  <TableCell>
                    {cls.status !== "COMPLETED" && cls.status !== "CANCELLED" && (
                      <Button variant="destructive" size="sm" onClick={() => setCancelId(cls.id)}>{t("common.cancel")}</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={cancelId !== null} onOpenChange={(val) => { if (!val) setCancelId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("common.confirm")}</DialogTitle></DialogHeader>
          <p className="text-sm">{t("classes.cancelConfirm")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelId(null)}>{t("common.no")}</Button>
            <Button variant="destructive" disabled={cancelMutation.isPending} onClick={() => { if (cancelId) cancelMutation.mutate({ id: cancelId }); }}>
              {cancelMutation.isPending ? t("common.loading") : t("common.yes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

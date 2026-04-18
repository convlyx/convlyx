"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { trpc } from "@/lib/trpc";
import { BookOpen } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/radix-select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

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
      <div className="flex items-center gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("classes.type")}: {t("common.filter")}</SelectItem>
            <SelectItem value="THEORY">{t("classes.theory")}</SelectItem>
            <SelectItem value="PRACTICAL">{t("classes.practical")}</SelectItem>
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
      ) : !classes || classes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <BookOpen className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">{t("classes.noClasses")}</p>
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
                  <TableCell>
                    <Badge variant="secondary">
                      {t(typeKeys[cls.classType] ?? cls.classType)}
                    </Badge>
                  </TableCell>
                  <TableCell>{cls.instructor.name}</TableCell>
                  <TableCell>
                    {format.dateTime(new Date(cls.startsAt), {
                      day: "2-digit", month: "2-digit", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                    {" — "}
                    {format.dateTime(new Date(cls.endsAt), {
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell>
                    {cls._count.enrollments}/{cls.capacity}
                  </TableCell>
                  <TableCell>
                    <Badge variant={classStatusVariant(cls.status)}>
                      {t(statusKeys[cls.status] ?? cls.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {cls.status !== "COMPLETED" && cls.status !== "CANCELLED" && (
                      <Button variant="destructive" size="sm" onClick={() => setCancelId(cls.id)}>
                        {t("common.cancel")}
                      </Button>
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
          <DialogHeader>
            <DialogTitle>{t("common.confirm")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm">{t("classes.cancelConfirm")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelId(null)}>
              {t("common.no")}
            </Button>
            <Button
              variant="destructive"
              disabled={cancelMutation.isPending}
              onClick={() => { if (cancelId) cancelMutation.mutate({ id: cancelId }); }}
            >
              {cancelMutation.isPending ? t("common.loading") : t("common.yes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

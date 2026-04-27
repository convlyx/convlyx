"use client";

import { useState, useEffect } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { BookOpen, Clock, Users, CalendarDays, Search, Pencil, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
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
import { EmptyState } from "@/components/empty-state";
import { typeKeys, statusKeys, statusVariant, classTypeColorMap, classTypeBadgeClass } from "@/lib/constants/class";
import { Pagination } from "@/components/pagination";
import { EditClassDialog } from "./edit-class-dialog";
import { CreateClassDialog } from "./create-class-dialog";
import { toast } from "sonner";
import { useTranslatedError } from "@/hooks/use-translated-error";
import type { UserRole } from "@/generated/prisma/enums";

const ITEMS_PER_PAGE = 10;

export function ClassesTable({ userRole, userId }: { userRole: UserRole; userId: string }) {
  const t = useTranslations();
  const { onError } = useTranslatedError();
  const format = useFormatter();
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
  const [view, setView] = useViewMode("/classes", initialView);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [typeFilter, setTypeFilter] = useState<string>(searchParams.get("type") ?? "ALL");
  const defaultStatus = (searchParams.get("time") ?? "upcoming") === "upcoming" ? "SCHEDULED" : "COMPLETED";
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") ?? defaultStatus);
  const [page, setPage] = useState(1);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [editClass, setEditClass] = useState<typeof filteredClasses[number] | null>(null);

  const isStudent = userRole === "STUDENT";
  const { data: classes, isLoading } = trpc.class.list.useQuery({
    ...(typeFilter !== "ALL" && { classType: typeFilter as "THEORY" | "PRACTICAL" }),
    status: statusFilter as "ALL" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
  });
  const { data: myEnrollments } = trpc.enrollment.listByStudent.useQuery(undefined, { enabled: isStudent });
  const enrolledSessionIds = new Set(myEnrollments?.map((e) => e.session.id) ?? []);

  const utils = trpc.useUtils();
  const cancelMutation = trpc.class.cancel.useMutation({
    onSuccess: () => {
      toast.success(t("toast.classCancelled"));
      utils.class.list.invalidate();
      setCancelId(null);
    },
    onError,
  });

  const enrollMutation = trpc.enrollment.enroll.useMutation({
    onSuccess: () => {
      toast.success(t("toast.enrollmentSuccess"));
      utils.class.list.invalidate();
      utils.enrollment.listByStudent.invalidate();
      setEnrollingId(null);
    },
    onError: (error) => {
      setEnrollingId(null);
      onError(error);
    },
  });

  const canManage = userRole === "ADMIN" || userRole === "SECRETARY";
  const isInstructor = userRole === "INSTRUCTOR";
  const canViewDetail = (cls: { instructor: { id: string } }) =>
    canManage || (isInstructor && cls.instructor.id === userId);
  const [timeTab, setTimeTab] = useState<string>(searchParams.get("time") ?? "upcoming");

  const now = new Date();
  const filteredClasses = classes?.filter((cls) => {
    if (!cls.title.toLowerCase().includes(search.toLowerCase())) return false;
    const isFuture = new Date(cls.startsAt as unknown as string) >= now;
    if (isStudent) {
      // Students only see future scheduled classes they can enroll in
      return isFuture
        && cls.status === "SCHEDULED"
        && !enrolledSessionIds.has(cls.id)
        && cls._count.enrollments < cls.capacity;
    }
    return timeTab === "upcoming" ? isFuture : !isFuture;
  }) ?? [];

  const totalPages = Math.ceil(filteredClasses.length / ITEMS_PER_PAGE);
  const paginatedClasses = filteredClasses.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => setPage(1), [search, typeFilter, statusFilter, timeTab]);

  function handleSearchChange(value: string) {
    setSearch(value);
    updateParams("search", value);
  }

  function handleTypeChange(value: string) {
    setTypeFilter(value);
    updateParams("type", value);
  }

  function handleStatusChange(value: string) {
    setStatusFilter(value);
    updateParams("status", value === "ALL" ? "" : value);
  }

  function handleViewChange(mode: "cards" | "table") {
    setView(mode);
    updateParams("view", mode);
  }

  function handleTimeTab(tab: string) {
    setTimeTab(tab);
    const newStatus = tab === "upcoming" ? "SCHEDULED" : "COMPLETED";
    setStatusFilter(newStatus);
    setPage(1);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "upcoming") {
      params.delete("time");
    } else {
      params.set("time", tab);
    }
    params.delete("status");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-4">
      {/* Time tabs (hidden for students) */}
      {!isStudent && (
        <div className="flex items-center gap-1 rounded-lg border p-0.5 w-fit">
          <Button
            variant={timeTab === "upcoming" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleTimeTab("upcoming")}
          >
            {t("classes.upcoming")}
          </Button>
          <Button
            variant={timeTab === "past" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleTimeTab("past")}
          >
            {t("classes.past")}
          </Button>
        </div>
      )}

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
          <Select value={typeFilter} onValueChange={handleTypeChange}>
            <SelectTrigger className="w-auto min-w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("classes.allTypes")}</SelectItem>
              <SelectItem value="THEORY">{t("classes.theory")}</SelectItem>
              <SelectItem value="PRACTICAL">{t("classes.practical")}</SelectItem>
            </SelectContent>
          </Select>
          {!isStudent && (
            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-auto min-w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeTab === "upcoming" ? (
                  <>
                    <SelectItem value="ALL">{t("classes.allStatuses")}</SelectItem>
                    <SelectItem value="SCHEDULED">{t("classes.scheduled")}</SelectItem>
                    <SelectItem value="IN_PROGRESS">{t("classes.inProgress")}</SelectItem>
                    <SelectItem value="CANCELLED">{t("classes.cancelled")}</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="ALL">{t("classes.allStatuses")}</SelectItem>
                    <SelectItem value="COMPLETED">{t("classes.completed")}</SelectItem>
                    <SelectItem value="CANCELLED">{t("classes.cancelled")}</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle view={view} onChange={handleViewChange} />
          {canManage && <CreateClassDialog />}
        </div>
      </div>

      {isLoading ? (
        <Loading />
      ) : filteredClasses.length === 0 ? (
        <EmptyState icon={BookOpen} message={t("classes.noClasses")} />
      ) : view === "cards" ? (
        <div className="grid gap-3">
          {paginatedClasses.map((cls) => {
            const isClickable = canViewDetail(cls);
            const cardClass = `rounded-xl border bg-card p-4 card-shadow hover:card-shadow-hover transition-all block ${isClickable ? "hover:border-primary/20 group" : ""}`;
            const cardContent = (
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl ${classTypeColorMap[cls.classType]}`}>
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className={`font-medium truncate ${isClickable ? "group-hover:text-primary transition-colors" : ""}`}>{cls.title}</p>
                      <Badge className={classTypeBadgeClass[cls.classType]}>{t(typeKeys[cls.classType])}</Badge>
                      <Badge variant={statusVariant[cls.status] ?? "outline"}>{t(statusKeys[cls.status])}</Badge>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1 truncate"><Users className="h-3.5 w-3.5 shrink-0" />{cls.instructor.name}</span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                        {format.dateTime(new Date(cls.startsAt), { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        {" · "}
                        {format.dateTime(new Date(cls.endsAt), { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 shrink-0" />{cls._count.enrollments}/{cls.capacity}</span>
                    </div>
                    {isStudent && cls.status === "SCHEDULED" && !enrolledSessionIds.has(cls.id) && cls._count.enrollments < cls.capacity && (
                      <div className="mt-2">
                        <Button
                          size="sm"
                          disabled={enrollingId === cls.id}
                          onClick={(e) => { e.preventDefault(); setEnrollingId(cls.id); enrollMutation.mutate({ sessionId: cls.id }); }}
                        >
                          {enrollingId === cls.id ? t("common.loading") : t("enrollment.enroll")}
                        </Button>
                      </div>
                    )}
                    {isStudent && enrolledSessionIds.has(cls.id) && (
                      <div className="mt-2">
                        <Badge variant="default">{t("enrollment.enrolled")}</Badge>
                      </div>
                    )}
                    {canManage && (cls.status === "SCHEDULED" || cls.status === "IN_PROGRESS") && (
                      <div className="mt-2 flex gap-2 sm:hidden" onClick={(e) => e.preventDefault()}>
                        <Button variant="outline" size="sm" onClick={(e) => { e.preventDefault(); setEditClass(cls); }}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />{t("common.edit")}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={(e) => { e.preventDefault(); setCancelId(cls.id); }}>{t("common.cancel")}</Button>
                      </div>
                    )}
                  </div>
                  {isClickable && (
                    <div className="hidden sm:flex shrink-0 gap-1 items-center">
                      {canManage && (cls.status === "SCHEDULED" || cls.status === "IN_PROGRESS") && (
                        <>
                          <Button variant="outline" size="icon-sm" onClick={(e) => { e.preventDefault(); setEditClass(cls); }} title={t("common.edit")}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="destructive" size="sm" onClick={(e) => { e.preventDefault(); setCancelId(cls.id); }}>{t("common.cancel")}</Button>
                        </>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors ml-1" />
                    </div>
                  )}
                </div>
            );
            return isClickable ? (
              <Link key={cls.id} href={`/classes/${cls.id}`} className={cardClass}>
                {cardContent}
              </Link>
            ) : (
              <div key={cls.id} className={cardClass}>
                {cardContent}
              </div>
            );
          })}
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
              {paginatedClasses.map((cls) => (
                <TableRow key={cls.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell>
                    {canViewDetail(cls) ? (
                      <Link href={`/classes/${cls.id}`} className="font-medium text-primary hover:underline">{cls.title}</Link>
                    ) : (
                      <span className="font-medium">{cls.title}</span>
                    )}
                  </TableCell>
                  <TableCell><Badge className={classTypeBadgeClass[cls.classType]}>{t(typeKeys[cls.classType])}</Badge></TableCell>
                  <TableCell>{cls.instructor.name}</TableCell>
                  <TableCell>
                    {format.dateTime(new Date(cls.startsAt), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    {format.dateTime(new Date(cls.endsAt), { hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell>{cls._count.enrollments}/{cls.capacity}</TableCell>
                  <TableCell><Badge variant={statusVariant[cls.status] ?? "outline"}>{t(statusKeys[cls.status])}</Badge></TableCell>
                  <TableCell>
                    {isStudent && cls.status === "SCHEDULED" && !enrolledSessionIds.has(cls.id) && cls._count.enrollments < cls.capacity && (
                      <Button
                        size="sm"
                        disabled={enrollingId === cls.id}
                        onClick={() => { setEnrollingId(cls.id); enrollMutation.mutate({ sessionId: cls.id }); }}
                      >
                        {enrollingId === cls.id ? t("common.loading") : t("enrollment.enroll")}
                      </Button>
                    )}
                    {isStudent && enrolledSessionIds.has(cls.id) && (
                      <Badge variant="default">{t("enrollment.enrolled")}</Badge>
                    )}
                    {canManage && (cls.status === "SCHEDULED" || cls.status === "IN_PROGRESS") && (
                      <div className="flex gap-1">
                        <Button variant="outline" size="icon-sm" onClick={() => setEditClass(cls)} title={t("common.edit")}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => setCancelId(cls.id)}>{t("common.cancel")}</Button>
                      </div>
                    )}
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
        total={filteredClasses.length}
        onPageChange={setPage}
      />

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

      {editClass && (
        <EditClassDialog
          classData={editClass}
          open={editClass !== null}
          onClose={() => setEditClass(null)}
        />
      )}
    </div>
  );
}

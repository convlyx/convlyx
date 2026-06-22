"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { toast } from "sonner";
import { ClipboardCheck, Check, X, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogBody,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CategoryBadge } from "@/components/category-badge";
import { typeKeys, classTypeBadgeClass } from "@/lib/constants/class";
import { useTranslatedError } from "@/hooks/use-translated-error";

const SESSION_DISMISS_KEY = "convlyx.pendingAttendance.autoOpened";

type AttendanceStatus = "ATTENDED" | "NO_SHOW";

export function PendingAttendanceModal() {
  const t = useTranslations();
  const format = useFormatter();
  const { onError } = useTranslatedError();

  const { data: pending } = trpc.enrollment.pendingAttendance.useQuery();
  const utils = trpc.useUtils();

  const [open, setOpen] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  // Per-enrollment selection state. Keyed by enrollmentId because IDs are
  // stable across refetches even when the parent session list re-orders.
  const [selections, setSelections] = useState<Record<string, AttendanceStatus>>({});

  const sessions = pending ?? [];

  // Auto-open once per browser session when there is anything pending.
  useEffect(() => {
    if (!sessions.length) return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_DISMISS_KEY)) return;
    sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    setOpen(true);
    setCardIndex(0);
  }, [sessions.length]);

  // Keep the card index inside the bounds of the current list. Sessions drop
  // out of `sessions` as attendance is recorded; the index needs to follow.
  useEffect(() => {
    if (sessions.length === 0) {
      setOpen(false);
      setCardIndex(0);
      return;
    }
    if (cardIndex >= sessions.length) {
      setCardIndex(sessions.length - 1);
    }
  }, [sessions.length, cardIndex]);

  const currentSession = sessions[cardIndex];

  const bulkSet = trpc.enrollment.bulkSetAttendance.useMutation({
    onSuccess: async () => {
      toast.success(t("toast.attendanceSaved"));
      await utils.enrollment.pendingAttendance.invalidate();
      // Clear selections so the next card starts fresh.
      setSelections({});
    },
    onError,
  });

  const allSelected = useMemo(() => {
    if (!currentSession) return false;
    return currentSession.enrollments.every((e) => !!selections[e.id]);
  }, [currentSession, selections]);

  if (!sessions.length) return null;

  function handleMarkAllPresent() {
    if (!currentSession) return;
    const next: Record<string, AttendanceStatus> = { ...selections };
    for (const enrollment of currentSession.enrollments) {
      next[enrollment.id] = "ATTENDED";
    }
    setSelections(next);
  }

  function handleSelect(enrollmentId: string, status: AttendanceStatus) {
    setSelections((prev) => ({ ...prev, [enrollmentId]: status }));
  }

  function handleSave() {
    if (!currentSession || !allSelected) return;
    const entries = currentSession.enrollments.map((e) => ({
      enrollmentId: e.id,
      status: selections[e.id]!,
    }));
    bulkSet.mutate({ sessionId: currentSession.id, entries });
  }

  function handleSkip() {
    if (cardIndex < sessions.length - 1) {
      setSelections({});
      setCardIndex((i) => i + 1);
    } else {
      setOpen(false);
    }
  }

  return (
    <>
      {/* Persistent banner — visible whenever there are pending classes,
          regardless of whether the modal has been dismissed this session. */}
      <button
        type="button"
        onClick={() => {
          setCardIndex(0);
          setSelections({});
          setOpen(true);
        }}
        className="w-full flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-left transition-colors hover:bg-primary/10"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {t("dashboard.pendingAttendanceBanner", { count: sessions.length })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("dashboard.pendingAttendanceSubtitle")}
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-primary shrink-0" />
        <span className="sr-only">{t("dashboard.pendingAttendanceAction")}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("dashboard.pendingAttendanceTitle")}</DialogTitle>
          </DialogHeader>
          {currentSession && (
            <>
              <DialogBody>
                <div className="space-y-4">
                  {sessions.length > 1 && (
                    <p className="text-xs text-muted-foreground">
                      {t("dashboard.pendingAttendanceCount", {
                        current: cardIndex + 1,
                        total: sessions.length,
                      })}
                    </p>
                  )}

                  <div className="rounded-xl border bg-card p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="font-semibold truncate">{currentSession.title}</h3>
                      <Badge className={classTypeBadgeClass[currentSession.classType]}>
                        {t(typeKeys[currentSession.classType])}
                      </Badge>
                      <CategoryBadge category={currentSession.category} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format.dateTime(new Date(currentSession.startsAt), {
                        weekday: "short",
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" · "}
                      {format.dateTime(new Date(currentSession.endsAt), {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>

                  {currentSession.enrollments.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleMarkAllPresent}
                      className="w-full"
                    >
                      <Check className="h-3.5 w-3.5 mr-1.5" />
                      {t("dashboard.markAllPresent")}
                    </Button>
                  )}

                  <div className="space-y-2">
                    {currentSession.enrollments.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        {t("dashboard.noStudentsPending")}
                      </p>
                    ) : (
                      currentSession.enrollments.map((enrollment) => {
                        const value = selections[enrollment.id];
                        return (
                          <div
                            key={enrollment.id}
                            className="flex items-center justify-between gap-3 rounded-lg border p-2.5"
                          >
                            <span className="text-sm font-medium truncate">
                              {enrollment.student.name}
                            </span>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                type="button"
                                size="sm"
                                variant={value === "ATTENDED" ? "default" : "outline"}
                                aria-pressed={value === "ATTENDED"}
                                onClick={() => handleSelect(enrollment.id, "ATTENDED")}
                              >
                                <Check className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                                {t("dashboard.present")}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={value === "NO_SHOW" ? "destructive" : "outline"}
                                aria-pressed={value === "NO_SHOW"}
                                onClick={() => handleSelect(enrollment.id, "NO_SHOW")}
                              >
                                <X className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                                {t("dashboard.absent")}
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleSkip}>
                  {t("dashboard.doLater")}
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={!allSelected || bulkSet.isPending}
                >
                  {bulkSet.isPending ? t("common.loading") : t("dashboard.saveAndNext")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

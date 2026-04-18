"use client";

import { useMemo } from "react";
import { useTranslations, useFormatter } from "next-intl";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Loading } from "@/components/loading";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  Clock,
  BookOpen,
  ChevronRight,
  Users,
  Timer,
  BookCheck,
  XCircle,
  Sparkles,
} from "lucide-react";
import { typeKeys, classTypeColorMap } from "@/lib/constants/class";
import { toast } from "sonner";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function getTimeUntil(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  if (diff < 0) return "agora";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `em ${days} ${days === 1 ? "dia" : "dias"}`;
  }
  if (hours > 0) return `em ${hours}h ${minutes}min`;
  return `em ${minutes}min`;
}

export function StudentHome({ userName }: { userName: string }) {
  const t = useTranslations();
  const format = useFormatter();

  const dateRange = useMemo(() => {
    const now = new Date();
    const weekFromNow = new Date(now);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    return { from: now.toISOString(), to: weekFromNow.toISOString() };
  }, []);

  const { data: classes, isLoading: classesLoading } = trpc.class.list.useQuery(dateRange);
  const { data: enrollments, isLoading: enrollmentsLoading } = trpc.enrollment.listByStudent.useQuery();

  const utils = trpc.useUtils();
  const enrollMutation = trpc.enrollment.enroll.useMutation({
    onSuccess: () => {
      toast.success("Inscrito com sucesso");
      utils.class.list.invalidate();
      utils.enrollment.listByStudent.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const allEnrollments = enrollments ?? [];
  const activeEnrollments = allEnrollments.filter((e) => e.status === "ENROLLED");
  const attendedCount = allEnrollments.filter((e) => e.status === "ATTENDED").length;
  const noShowCount = allEnrollments.filter((e) => e.status === "NO_SHOW").length;
  const enrolledSessionIds = new Set(activeEnrollments.map((e) => e.session.id));

  const nextClass = activeEnrollments
    .filter((e) => new Date(e.session.startsAt) > new Date() && e.session.status === "SCHEDULED")
    .sort((a, b) => new Date(a.session.startsAt).getTime() - new Date(b.session.startsAt).getTime())[0];

  const availableClasses = classes?.filter(
    (cls) => cls.status === "SCHEDULED" && !enrolledSessionIds.has(cls.id) && cls._count.enrollments < cls.capacity
  ) ?? [];

  const isLoading = classesLoading || enrollmentsLoading;
  if (isLoading) return <Loading />;

  const firstName = userName.split(" ")[0];
  const totalClasses = attendedCount + noShowCount;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <p className="text-sm text-muted-foreground">{getGreeting()}</p>
        <h1 className="text-2xl font-bold">{firstName} 👋</h1>
      </div>

      {/* Hero — next class */}
      {nextClass ? (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 p-5 text-primary-foreground">
          <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/10" />
          <div className="absolute -bottom-8 -left-4 h-20 w-20 rounded-full bg-white/5" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs font-medium opacity-80 uppercase tracking-wide">
              <Timer className="h-3.5 w-3.5" />
              {getTimeUntil(new Date(nextClass.session.startsAt))}
            </div>
            <h2 className="text-xl font-bold mt-2">{nextClass.session.title}</h2>
            <div className="mt-4 space-y-2 text-sm opacity-90">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {format.dateTime(new Date(nextClass.session.startsAt), {
                    weekday: "long", day: "2-digit", month: "long",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0" />
                {format.dateTime(new Date(nextClass.session.startsAt), { hour: "2-digit", minute: "2-digit" })}
                {" · "}
                {format.dateTime(new Date(nextClass.session.endsAt), { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 shrink-0" />
                <span className="truncate">{nextClass.session.instructor.name}</span>
              </div>
            </div>
            <div className="mt-3">
              <Badge className="bg-white/20 text-white border-0 hover:bg-white/30">
                {t(typeKeys[nextClass.session.classType])}
              </Badge>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-muted-foreground/20 p-8 text-center">
          <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Sem aulas agendadas</p>
          <Link href="/classes" className="text-sm text-primary font-medium mt-1 inline-block">
            Explorar aulas disponíveis
          </Link>
        </div>
      )}

      {/* Stats — progress card */}
      <div className="rounded-xl border bg-card p-4 card-shadow">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-3">O meu progresso</p>
        <div className="flex items-center justify-around">
          <div className="flex flex-col items-center gap-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            <span className="text-lg font-bold">{activeEnrollments.length}</span>
            <span className="text-[10px] text-muted-foreground">Agendadas</span>
          </div>
          <div className="w-px h-10 bg-border" />
          <div className="flex flex-col items-center gap-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
              <BookCheck className="h-4 w-4 text-emerald-500" />
            </div>
            <span className="text-lg font-bold">{attendedCount}</span>
            <span className="text-[10px] text-muted-foreground">Presenças</span>
          </div>
          <div className="w-px h-10 bg-border" />
          <div className="flex flex-col items-center gap-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="h-4 w-4 text-destructive" />
            </div>
            <span className="text-lg font-bold">{noShowCount}</span>
            <span className="text-[10px] text-muted-foreground">Faltas</span>
          </div>
        </div>
        {totalClasses > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>Assiduidade</span>
              <span className="font-medium text-foreground">{Math.round((attendedCount / totalClasses) * 100)}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${totalClasses > 0 ? (attendedCount / totalClasses) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* My upcoming enrollments */}
      {activeEnrollments.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">As minhas aulas</h2>
            <Link href="/enrollments" className="text-sm text-primary font-medium flex items-center gap-0.5">
              Ver todas <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-3">
            {activeEnrollments.slice(0, 4).map((enrollment) => (
              <div
                key={enrollment.id}
                className="flex items-start gap-3 rounded-xl border bg-card p-4 card-shadow hover:card-shadow-hover transition-all"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${classTypeColorMap[enrollment.session.classType]}`}>
                  <BookOpen className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold truncate">{enrollment.session.title}</p>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {t(typeKeys[enrollment.session.classType])}
                    </Badge>
                  </div>
                  <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="h-3 w-3 shrink-0" />
                      {format.dateTime(new Date(enrollment.session.startsAt), {
                        weekday: "short", day: "2-digit", month: "2-digit",
                        hour: "2-digit", minute: "2-digit",
                      })}
                      {" · "}
                      {format.dateTime(new Date(enrollment.session.endsAt), {
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3 w-3 shrink-0" />
                      <span className="truncate">{enrollment.session.instructor.name}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available classes */}
      {availableClasses.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Disponíveis</h2>
            <Link href="/classes" className="text-sm text-primary font-medium flex items-center gap-0.5">
              Ver todas <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-3">
            {availableClasses.slice(0, 5).map((cls) => (
              <div
                key={cls.id}
                className="flex items-start gap-3 rounded-xl border bg-card p-4 card-shadow hover:card-shadow-hover transition-all"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${classTypeColorMap[cls.classType]}`}>
                  <BookOpen className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold truncate">{cls.title}</p>
                    <Button
                      size="sm"
                      className="shrink-0 rounded-lg"
                      disabled={enrollMutation.isPending}
                      onClick={() => enrollMutation.mutate({ sessionId: cls.id })}
                    >
                      {t("enrollment.enroll")}
                    </Button>
                  </div>
                  <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="h-3 w-3 shrink-0" />
                      {format.dateTime(new Date(cls.startsAt), {
                        weekday: "short", day: "2-digit", month: "2-digit",
                        hour: "2-digit", minute: "2-digit",
                      })}
                      {" · "}
                      {format.dateTime(new Date(cls.endsAt), {
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3 w-3 shrink-0" />
                      <span>{cls.instructor.name}</span>
                      <span>·</span>
                      <span>{cls._count.enrollments}/{cls.capacity} vagas</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeEnrollments.length === 0 && availableClasses.length === 0 && !nextClass && (
        <EmptyState icon={BookOpen} message="Sem aulas disponíveis esta semana" />
      )}
    </div>
  );
}

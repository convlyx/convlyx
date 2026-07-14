"use client";

import Link from "next/link";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ArrowLeft, GraduationCap, Users, Activity, CalendarDays, Award, Clock,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useUrlParam } from "@/hooks/use-url-param";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/radix-select";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { DataTableCard } from "@/components/data-table-card";
import { SrDataTable } from "@/components/sr-data-table";
import { ChartCard } from "@/app/(dashboard)/analytics/_components/chart-card";
import { toast } from "sonner";
import { formatBucket, formatDate } from "../../../_components/admin-format";
import { TenantActions } from "./tenant-actions";
import { EditSchoolDialog } from "./edit-school-dialog";

const CHART_COLORS = ["var(--primary)", "var(--info)", "var(--muted-foreground)"];

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin", SECRETARY: "Secretaria", INSTRUCTOR: "Instrutor", STUDENT: "Aluno",
};
const FUNNEL_LABEL: Record<string, string> = {
  ENROLLED: "Inscrito", ATTENDED: "Presente", NO_SHOW: "Faltou", CANCELLED: "Cancelado",
};
const COURSE_LABEL: Record<string, string> = {
  IN_PROGRESS: "Em curso", COMPLETED: "Concluído", ABANDONED: "Abandonado",
};
const CONSENT_LABEL: Record<string, string> = {
  CONTROLLER_DPA: "DPA (responsável)", USER_TERMS: "Termos (utilizador)",
};

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "0.5rem",
  fontSize: "0.875rem",
} as const;

export function AccountDetail({ tenantId }: { tenantId: string }) {
  const [school, setSchool] = useUrlParam<string>("school", "ALL");
  const [rangeRaw, setRange] = useUrlParam<string>("range", "90");
  const rangeDays = ([30, 90, 365] as number[]).includes(Number(rangeRaw))
    ? (Number(rangeRaw) as 30 | 90 | 365)
    : 90;
  const schoolId = school === "ALL" ? undefined : school;

  const account = trpc.admin.account.get.useQuery({ tenantId });
  const charts = trpc.admin.account.charts.useQuery({ tenantId, ...(schoolId && { schoolId }), rangeDays });
  const timeline = trpc.admin.account.timeline.useInfiniteQuery(
    { tenantId },
    { getNextPageParam: (last) => last.nextCursor ?? undefined },
  );
  const utils = trpc.useUtils();
  const setStatus = trpc.admin.ops.setMembershipStatus.useMutation({
    onSuccess: () => utils.admin.account.get.invalidate({ tenantId }),
    onError: () => toast.error("Erro ao alterar estado"),
  });

  if (account.isLoading) {
    return <Skeleton className="h-96 w-full rounded-xl" />;
  }
  if (account.error || !account.data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <EmptyState icon={Users} message="Grupo não encontrado." />
      </div>
    );
  }

  const { tenant, schools, snapshot, members, consents, lastActiveAt } = account.data;
  const c = charts.data;
  const timelineItems = timeline.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <BackLink />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{tenant.name}</h1>
            <Badge variant={tenant.status === "ACTIVE" ? "default" : "destructive"}>
              {tenant.status === "ACTIVE" ? "Ativo" : "Inativo"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {schools.length} {schools.length === 1 ? "escola" : "escolas"} · desde{" "}
            {formatDate(tenant.createdAt)} · última atividade {formatDate(lastActiveAt)}
          </p>
        </div>
        <TenantActions tenantId={tenantId} tenantName={tenant.name} status={tenant.status} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {schools.length > 1 && (
          <Select value={school} onValueChange={setSchool}>
            <SelectTrigger className="w-auto min-w-[180px]" aria-label="Escola"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas as escolas</SelectItem>
              {schools.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={String(rangeDays)} onValueChange={setRange}>
          <SelectTrigger className="w-auto min-w-[130px]" aria-label="Intervalo"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="365">Último ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Snapshot */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard icon={GraduationCap} label="Alunos ativos" value={snapshot.activeStudents} />
        <StatCard icon={Users} label="Instrutores" value={snapshot.instructors} />
        <StatCard icon={Activity} label="Ativos (7 dias)" value={snapshot.wau} />
        <StatCard icon={CalendarDays} label="Aulas (30 dias)" value={snapshot.classes30d} />
        <StatCard
          icon={Award}
          label="Aprovação"
          value={snapshot.passRate == null ? 0 : Math.round(snapshot.passRate * 100)}
          description={snapshot.passRate == null ? "sem exames" : "% aprovados"}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Inscrições ao longo do tempo">
          <ChartOrEmpty loading={charts.isLoading} empty={!c || c.enrolments.every((d) => d.count === 0)}>
            <div className="h-64 w-full" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(c?.enrolments ?? []).map((d) => ({ ...d, label: formatBucket(d.bucket, c!.granularity) }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--foreground)" }} formatter={(v) => [`${v}`, "Inscrições"]} />
                  <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <SrDataTable caption="Inscrições ao longo do tempo" columns={["Período", "Inscrições"]} rows={(c?.enrolments ?? []).map((d) => [formatBucket(d.bucket, c!.granularity), d.count])} />
          </ChartOrEmpty>
        </ChartCard>

        <ChartCard title="Aulas: teórica vs prática">
          <ChartOrEmpty loading={charts.isLoading} empty={!c || c.classesByType.every((d) => d.theory === 0 && d.practical === 0)}>
            <div className="h-64 w-full" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(c?.classesByType ?? []).map((d) => ({ ...d, label: formatBucket(d.bucket, c!.granularity) }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--foreground)" }} />
                  <Legend />
                  <Bar dataKey="theory" name="Teórica" stackId="t" fill="var(--primary)" isAnimationActive={false} />
                  <Bar dataKey="practical" name="Prática" stackId="t" fill="var(--info)" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <SrDataTable caption="Aulas por tipo" columns={["Período", "Teórica", "Prática"]} rows={(c?.classesByType ?? []).map((d) => [formatBucket(d.bucket, c!.granularity), d.theory, d.practical])} />
          </ChartOrEmpty>
        </ChartCard>

        <ChartCard title="Funil de inscrição">
          <ChartOrEmpty loading={charts.isLoading} empty={!c || c.funnel.every((d) => d.count === 0)}>
            <div className="h-64 w-full" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={(c?.funnel ?? []).map((d) => ({ ...d, label: FUNNEL_LABEL[d.status] }))} margin={{ top: 8, right: 8, left: 24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={72} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--foreground)" }} formatter={(v) => [`${v}`, "Inscrições"]} />
                  <Bar dataKey="count" fill="var(--primary)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <SrDataTable caption="Funil de inscrição" columns={["Estado", "Inscrições"]} rows={(c?.funnel ?? []).map((d) => [FUNNEL_LABEL[d.status], d.count])} />
          </ChartOrEmpty>
        </ChartCard>

        <ChartCard title="Taxa de aprovação por categoria">
          <ChartOrEmpty loading={charts.isLoading} empty={!c || c.passByCategory.length === 0}>
            <div className="h-64 w-full" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(c?.passByCategory ?? []).map((d) => ({ ...d, pct: Math.round(d.passRate * 100) }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="category" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--foreground)" }} formatter={(v, _n, p) => [`${v}% (${p.payload.passed}/${p.payload.attempts})`, "Aprovação"]} />
                  <Bar dataKey="pct" fill="var(--primary)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <SrDataTable caption="Taxa de aprovação por categoria" columns={["Categoria", "Aprovados", "Tentativas", "Taxa"]} rows={(c?.passByCategory ?? []).map((d) => [d.category, d.passed, d.attempts, `${Math.round(d.passRate * 100)}%`])} />
          </ChartOrEmpty>
        </ChartCard>

        <ChartCard title="Conclusão de cursos">
          <ChartOrEmpty loading={charts.isLoading} empty={!c || c.courseCompletion.every((d) => d.count === 0)}>
            <div className="h-64 w-full" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={(c?.courseCompletion ?? []).map((d) => ({ name: COURSE_LABEL[d.status] ?? d.status, value: d.count }))} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {(c?.courseCompletion ?? []).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--foreground)" }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <SrDataTable caption="Conclusão de cursos" columns={["Estado", "Cursos"]} rows={(c?.courseCompletion ?? []).map((d) => [COURSE_LABEL[d.status] ?? d.status, d.count])} />
          </ChartOrEmpty>
        </ChartCard>
      </div>

      {/* Members + Timeline */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Membros">
          <div className="flex flex-wrap gap-2">
            {Object.entries(members.byRole).map(([role, counts]) => (
              <Badge key={role} variant="secondary">
                {ROLE_LABEL[role] ?? role}: {counts.active}
                {counts.inactive ? ` (+${counts.inactive} inativos)` : ""}
              </Badge>
            ))}
          </div>
          <DataTableCard>
            <Table>
              <caption className="sr-only">Equipa (staff) do grupo</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Escola</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.staff.map((m) => (
                  <TableRow key={m.membershipId}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-muted-foreground">{m.email}</TableCell>
                    <TableCell className="text-muted-foreground">{m.phone ?? "—"}</TableCell>
                    <TableCell>{ROLE_LABEL[m.role] ?? m.role}</TableCell>
                    <TableCell className="text-muted-foreground">{m.schoolName}</TableCell>
                    <TableCell>
                      {m.status === "ACTIVE" ? (
                        <span className="text-success">Ativo</span>
                      ) : (
                        <span className="text-muted-foreground">Inativo</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {m.status === "ACTIVE" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          disabled={setStatus.isPending}
                          onClick={() => setStatus.mutate({ membershipId: m.membershipId, status: "INACTIVE" })}
                        >
                          Desativar
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={setStatus.isPending}
                          onClick={() => setStatus.mutate({ membershipId: m.membershipId, status: "ACTIVE" })}
                        >
                          Reativar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTableCard>
          <Link href={`/platform-admin/tenants/${tenantId}/students`}>
            <Button variant="outline" size="sm">Ver alunos</Button>
          </Link>
        </ChartCard>

        <ChartCard title="Atividade recente">
          {timelineItems.length === 0 ? (
            <EmptyState icon={Clock} message="Sem atividade registada." />
          ) : (
            <>
              <ul className="space-y-3">
                {timelineItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div>
                      <p>{item.label}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(item.at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {timeline.hasNextPage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => timeline.fetchNextPage()}
                  disabled={timeline.isFetchingNextPage}
                >
                  {timeline.isFetchingNextPage ? "A carregar…" : "Carregar mais"}
                </Button>
              )}
            </>
          )}
        </ChartCard>
      </div>

      {/* Config + Consents */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Configuração">
          <div className="space-y-3">
            {schools.map((s) => (
              <div key={s.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{s.name} <span className="text-muted-foreground">· {s.subdomain}</span></p>
                  <EditSchoolDialog
                    tenantId={tenantId}
                    school={{ id: s.id, name: s.name, config: { cancellationNoticeHours: s.config.cancellationNoticeHours, practicalSelfEnrollEnabled: s.config.practicalSelfEnrollEnabled } }}
                  />
                </div>
                <ul className="mt-1 text-muted-foreground">
                  <li>Fuso horário: {s.config.timeZone}</li>
                  <li>Aviso de cancelamento: {s.config.cancellationNoticeHours}h</li>
                  <li>Auto-inscrição prática: {s.config.practicalSelfEnrollEnabled ? "Sim" : "Não"}</li>
                </ul>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Consentimentos">
          {consents.length === 0 ? (
            <EmptyState icon={Award} message="Sem registos de consentimento." />
          ) : (
            <ul className="space-y-2 text-sm">
              {consents.map((c2) => (
                <li key={c2.type} className="flex items-center justify-between">
                  <span>{CONSENT_LABEL[c2.type] ?? c2.type}</span>
                  <Badge variant="secondary">{c2.count}</Badge>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/platform-admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Visão geral
    </Link>
  );
}

function ChartOrEmpty({
  loading,
  empty,
  children,
}: {
  loading: boolean;
  empty: boolean;
  children: React.ReactNode;
}) {
  if (loading) return <Skeleton className="h-64 w-full" />;
  if (empty) return <EmptyState icon={CalendarDays} message="Sem dados no período." />;
  return <>{children}</>;
}

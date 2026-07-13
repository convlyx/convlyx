"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { keepPreviousData } from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Building2, Users, CalendarDays, CircleAlert, Search, Plus, ClipboardList } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useUrlParam, useUrlParamInt, useDebouncedUrlParam } from "@/hooks/use-url-param";
import { StatCard } from "@/components/stat-card";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/radix-select";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { DataTableCard } from "@/components/data-table-card";
import { ChartCard } from "@/app/(dashboard)/analytics/_components/chart-card";
import { HealthBadge } from "./health-badge";

const PAGE_SIZE = 10;

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";
type RiskFilter = "ALL" | "HEALTHY" | "AT_RISK" | "NEW" | "INACTIVE";
type SortKey = "name" | "createdAt" | "students" | "classes30d";

/** Compact bucket label for the trend charts (internal tool, pt-PT). */
function formatBucket(bucket: string, granularity: "day" | "week" | "month"): string {
  if (granularity === "month") {
    const [y, m] = bucket.split("-");
    const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    return `${months[Number(m) - 1]} ${y.slice(2)}`;
  }
  const [, m, d] = bucket.split("-");
  return `${d}/${m}`;
}

/** Human account age from days. */
function formatAge(days: number): string {
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}m`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem ? `${years}a ${rem}m` : `${years}a`;
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  const pts = data
    .map((v, i) => `${(i / Math.max(1, data.length - 1)) * 60},${20 - (v / max) * 18}`)
    .join(" ");
  return (
    <svg width="60" height="20" viewBox="0 0 60 20" aria-hidden="true" className="text-primary">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function PortfolioOverview() {
  const [page, setPage] = useUrlParamInt("page", 1);
  const [searchInput, committedSearch, setSearch] = useDebouncedUrlParam("q", "");
  const [status, setStatus] = useUrlParam<StatusFilter>("status", "ALL");
  const [risk, setRisk] = useUrlParam<RiskFilter>("risk", "ALL");
  const [sort, setSort] = useUrlParam<SortKey>("sort", "name");

  // Reset to page 1 whenever a filter changes (skip the first render).
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committedSearch, status, risk, sort]);

  const kpis = trpc.admin.portfolio.kpis.useQuery();
  const trends = trpc.admin.portfolio.trends.useQuery({ rangeDays: 90 });
  const overview = trpc.admin.portfolio.overview.useQuery(
    {
      page,
      pageSize: PAGE_SIZE,
      ...(committedSearch ? { search: committedSearch } : {}),
      status,
      risk,
      sort,
    },
    { placeholderData: keepPreviousData },
  );

  const rows = overview.data?.items ?? [];
  const total = overview.data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const granularity = trends.data?.granularity ?? "week";

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader title="Visão geral" description="Todas as escolas e a sua saúde num só sítio.">
        <Link href="/platform-admin/manage">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Criar / gerir
          </Button>
        </Link>
        <Link href="/platform-admin/audit">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
            Auditoria
          </Button>
        </Link>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.isLoading || !kpis.data ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
        ) : (
          <>
            <StatCard icon={Building2} label="Escolas" value={kpis.data.schools} />
            <StatCard icon={Users} label="Utilizadores ativos" value={kpis.data.activeMembers} />
            <StatCard icon={CalendarDays} label="Aulas (30 dias)" value={kpis.data.classes30d} />
            <StatCard icon={CircleAlert} label="Em risco" value={kpis.data.atRiskCount} />
          </>
        )}
      </div>

      {/* Trends */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Novas escolas" subtitle="Últimos 90 dias">
          {trends.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="h-64 w-full" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={(trends.data?.newSchools ?? []).map((d) => ({ ...d, label: formatBucket(d.bucket, granularity) }))}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: "0.5rem", fontSize: "0.875rem" }}
                    labelStyle={{ color: "var(--foreground)" }}
                    formatter={(v) => [`${v}`, "Novas escolas"]}
                  />
                  <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Atividade" subtitle="Aulas e inscrições · últimos 90 dias">
          {trends.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="h-64 w-full" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={(trends.data?.activity ?? []).map((d) => ({ ...d, label: formatBucket(d.bucket, granularity) }))}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: "0.5rem", fontSize: "0.875rem" }}
                    labelStyle={{ color: "var(--foreground)" }}
                  />
                  <Line type="monotone" dataKey="classes" name="Aulas" stroke="var(--primary)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="enrolments" name="Inscrições" stroke="var(--info)" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={searchInput}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Procurar escola…"
            className="w-[220px] pl-8"
            aria-label="Procurar escola"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="w-auto min-w-[130px]" aria-label="Estado"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os estados</SelectItem>
            <SelectItem value="ACTIVE">Ativos</SelectItem>
            <SelectItem value="INACTIVE">Inativos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={risk} onValueChange={(v) => setRisk(v as RiskFilter)}>
          <SelectTrigger className="w-auto min-w-[130px]" aria-label="Saúde"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Toda a saúde</SelectItem>
            <SelectItem value="HEALTHY">Saudável</SelectItem>
            <SelectItem value="AT_RISK">Em risco</SelectItem>
            <SelectItem value="NEW">Novo</SelectItem>
            <SelectItem value="INACTIVE">Inativo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-auto min-w-[150px]" aria-label="Ordenar"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Nome</SelectItem>
            <SelectItem value="createdAt">Mais recentes</SelectItem>
            <SelectItem value="students">Mais alunos</SelectItem>
            <SelectItem value="classes30d">Mais aulas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Schools table */}
      {overview.isLoading ? (
        <Skeleton className="h-72 w-full rounded-xl" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Building2} message="Nenhuma escola corresponde aos filtros." />
      ) : (
        <DataTableCard className={overview.isFetching ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <Table>
            <caption className="sr-only">Lista de escolas com métricas de saúde</caption>
            <TableHeader>
              <TableRow>
                <TableHead>Escola</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead className="text-right">Idade</TableHead>
                <TableHead className="text-right">WAU</TableHead>
                <TableHead className="text-right">Alunos</TableHead>
                <TableHead className="text-right">Aulas 30d</TableHead>
                <TableHead className="text-right">Aprovação</TableHead>
                <TableHead>Tendência</TableHead>
                <TableHead>Saúde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.schoolId}>
                  <TableCell className="font-medium">
                    <Link href={`/platform-admin/tenants/${r.tenantId}`} className="hover:underline">
                      {r.schoolName}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{r.subdomain}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.tenantName}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatAge(r.ageDays)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.wau}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.activeStudents}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.classes30d}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.passRate == null ? "—" : `${Math.round(r.passRate * 100)}%`}
                  </TableCell>
                  <TableCell><Sparkline data={r.sparkline} /></TableCell>
                  <TableCell><HealthBadge health={r.health} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableCard>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
    </div>
  );
}

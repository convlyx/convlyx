"use client";

import Link from "next/link";
import { keepPreviousData } from "@tanstack/react-query";
import { ArrowLeft, Users, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useUrlParamInt, useDebouncedUrlParam } from "@/hooks/use-url-param";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { DataTableCard } from "@/components/data-table-card";
import { PiiNotice } from "../../../../_components/pii-notice";

const PAGE_SIZE = 20;

export function StudentsList({ tenantId }: { tenantId: string }) {
  const [page, setPage] = useUrlParamInt("page", 1);
  const [searchInput, committedSearch, setSearch] = useDebouncedUrlParam("q", "");

  const q = trpc.admin.support.listStudents.useQuery(
    { tenantId, page, pageSize: PAGE_SIZE, ...(committedSearch ? { search: committedSearch } : {}) },
    { placeholderData: keepPreviousData, refetchOnWindowFocus: false, staleTime: 5 * 60_000 },
  );

  const rows = q.data?.items ?? [];
  const total = q.data?.total ?? 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Link href={`/platform-admin/tenants/${tenantId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Voltar ao grupo
      </Link>
      <PageHeader title="Alunos" description="Consulta de suporte — apenas leitura." />
      <PiiNotice />

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          value={searchInput}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Procurar por nome ou email…"
          className="w-[260px] pl-8"
          aria-label="Procurar aluno"
        />
      </div>

      {q.isLoading ? (
        <Skeleton className="h-72 w-full rounded-xl" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} message="Nenhum aluno encontrado." />
      ) : (
        <DataTableCard className={q.isFetching ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <Table>
            <caption className="sr-only">Lista de alunos do grupo</caption>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Cursos ativos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.membershipId}>
                  <TableCell className="font-medium">
                    <Link href={`/platform-admin/tenants/${tenantId}/students/${s.userId}`} className="hover:underline">
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.email}</TableCell>
                  <TableCell className="text-muted-foreground">{s.phone ?? "—"}</TableCell>
                  <TableCell>
                    {s.status === "ACTIVE" ? <span className="text-success">Ativo</span> : <span className="text-muted-foreground">Inativo</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{s.activeCourses}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableCard>
      )}

      <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} total={total} onPageChange={setPage} />
    </div>
  );
}

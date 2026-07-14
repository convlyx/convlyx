"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, UserSearch } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { DataTableCard } from "@/components/data-table-card";
import { PiiNotice } from "../../_components/pii-notice";
import { formatDate } from "../../_components/admin-format";

const ROLE_LABEL: Record<string, string> = { ADMIN: "Admin", SECRETARY: "Secretaria", INSTRUCTOR: "Instrutor", STUDENT: "Aluno" };

export function UserLookup() {
  const [input, setInput] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const q = trpc.admin.support.lookupUser.useQuery(
    { email: email ?? "" },
    { enabled: !!email, refetchOnWindowFocus: false, staleTime: 5 * 60_000 },
  );

  const isEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.trim());

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Link href="/platform-admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Visão geral
      </Link>
      <PageHeader title="Procurar utilizador" description="Encontre um utilizador por email em todos os grupos." />
      <PiiNotice />

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => { e.preventDefault(); if (isEmail) setEmail(input.trim().toLowerCase()); }}
      >
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={input} onChange={(e) => setInput(e.target.value)} type="email" placeholder="email@exemplo.pt" className="w-[280px] pl-8" aria-label="Email do utilizador" />
        </div>
        <Button type="submit" disabled={!isEmail}>Procurar</Button>
      </form>

      {email && q.isLoading && <Skeleton className="h-40 w-full rounded-xl" />}
      {email && !q.isLoading && q.data && !q.data.found && (
        <EmptyState icon={UserSearch} message="Nenhum utilizador com esse email." />
      )}
      {q.data?.found && q.data.user && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{q.data.user.name}</h2>
            <p className="text-sm text-muted-foreground">{q.data.user.email} · conta desde {formatDate(q.data.user.createdAt)}</p>
          </div>
          <DataTableCard>
            <Table>
              <caption className="sr-only">Pertenças do utilizador</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Escola</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Grupo ativo?</TableHead>
                  <TableHead>Última atividade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.memberships.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      <Link href={`/platform-admin/tenants/${m.tenantId}`} className="hover:underline">{m.tenantName}</Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.schoolName}</TableCell>
                    <TableCell>{ROLE_LABEL[m.role] ?? m.role}</TableCell>
                    <TableCell>{m.status === "ACTIVE" ? <span className="text-success">Ativo</span> : <span className="text-muted-foreground">Inativo</span>}</TableCell>
                    <TableCell>{m.tenantStatus === "ACTIVE" ? "Sim" : <Badge variant="destructive">Suspenso</Badge>}</TableCell>
                    <TableCell className="text-muted-foreground">{m.lastSeenAt ? formatDate(m.lastSeenAt) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTableCard>
        </div>
      )}
    </div>
  );
}

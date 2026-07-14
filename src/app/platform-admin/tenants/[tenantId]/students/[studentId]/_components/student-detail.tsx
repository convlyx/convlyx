"use client";

import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { DataTableCard } from "@/components/data-table-card";
import { ChartCard } from "@/app/(dashboard)/analytics/_components/chart-card";
import { PiiNotice } from "../../../../../_components/pii-notice";
import { formatDate } from "../../../../../_components/admin-format";

const COURSE_LABEL: Record<string, string> = { IN_PROGRESS: "Em curso", COMPLETED: "Concluído", ABANDONED: "Abandonado" };
const ENROLL_LABEL: Record<string, string> = { ENROLLED: "Inscrito", ATTENDED: "Presente", NO_SHOW: "Faltou", CANCELLED: "Cancelado" };
const EXAM_LABEL: Record<string, string> = { SCHEDULED: "Agendado", PASSED: "Aprovado", FAILED: "Reprovado", NO_SHOW: "Faltou", CANCELLED: "Cancelado" };

export function StudentDetail({ tenantId, studentUserId }: { tenantId: string; studentUserId: string }) {
  const q = trpc.admin.support.getStudent.useQuery(
    { tenantId, studentUserId },
    { refetchOnWindowFocus: false, staleTime: 5 * 60_000 },
  );

  if (q.isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;
  if (q.error || !q.data) {
    return (
      <div className="space-y-4">
        <Back tenantId={tenantId} />
        <EmptyState icon={Users} message="Aluno não encontrado." />
      </div>
    );
  }

  const { profile, courses, enrollments, exams } = q.data;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Back tenantId={tenantId} />
      <PiiNotice />

      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{profile.name}</h1>
          <Badge variant={profile.status === "ACTIVE" ? "default" : "destructive"}>
            {profile.status === "ACTIVE" ? "Ativo" : "Inativo"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {profile.email}{profile.phone ? ` · ${profile.phone}` : ""} · {profile.schoolName} · desde {formatDate(profile.joinedAt)}
        </p>
        {profile.qualifiedCategories.length > 0 && (
          <p className="text-sm text-muted-foreground">Categorias: {profile.qualifiedCategories.join(", ")}</p>
        )}
      </div>

      <ChartCard title="Cursos">
        {courses.length === 0 ? (
          <EmptyState icon={Users} message="Sem cursos." />
        ) : (
          <DataTableCard>
            <Table>
              <caption className="sr-only">Cursos do aluno</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Conclusão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{c.category}</TableCell>
                    <TableCell>{COURSE_LABEL[c.status] ?? c.status}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(c.startedAt)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(c.completedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTableCard>
        )}
      </ChartCard>

      <ChartCard title="Inscrições recentes">
        {enrollments.length === 0 ? (
          <EmptyState icon={Users} message="Sem inscrições." />
        ) : (
          <DataTableCard>
            <Table>
              <caption className="sr-only">Inscrições do aluno</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Aula</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Check-in</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{e.session.title}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(e.session.startsAt)}</TableCell>
                    <TableCell>{e.session.classType === "THEORY" ? "Teórica" : "Prática"}</TableCell>
                    <TableCell>{ENROLL_LABEL[e.status] ?? e.status}</TableCell>
                    <TableCell className="text-muted-foreground">{e.checkedInAt ? formatDate(e.checkedInAt) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTableCard>
        )}
      </ChartCard>

      <ChartCard title="Exames">
        {exams.length === 0 ? (
          <EmptyState icon={Users} message="Sem exames." />
        ) : (
          <DataTableCard>
            <Table>
              <caption className="sr-only">Exames do aluno</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exams.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell>{e.type === "THEORY" ? "Teórico" : "Prático"}</TableCell>
                    <TableCell className="font-medium">{e.category}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(e.scheduledAt)}</TableCell>
                    <TableCell>{EXAM_LABEL[e.result] ?? e.result}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTableCard>
        )}
      </ChartCard>
    </div>
  );
}

function Back({ tenantId }: { tenantId: string }) {
  return (
    <Link href={`/platform-admin/tenants/${tenantId}/students`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Voltar aos alunos
    </Link>
  );
}

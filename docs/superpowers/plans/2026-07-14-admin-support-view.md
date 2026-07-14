# Admin Support View — Implementation Plan (Sub-project 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give operators an audited, read-only way to inspect an individual student's data (profile, courses, enrolments, exams) inside `admin.convlyx.com`, for support/troubleshooting — without impersonation and without touching the shared auth path.

**Architecture:** Add an `admin.support` tRPC router of `adminProcedure` queries that read a single tenant's student data cross-tenant (raw db) and write an `AuditLog` row on every access. Surface it as two read-only pages under the existing per-account route (`…/tenants/[tenantId]/students` list + `…/students/[studentUserId]` detail), reached from the account page's (now enabled) "Ver alunos" button. No mutations, no impersonation, no middleware/context changes.

**Tech Stack:** Next.js 16 App Router, tRPC v11, Prisma 7, Zod v4, Tailwind v4, Vitest 4.

## Global Constraints

- **Package manager: `pnpm`.**
- **Git is user-driven.** Do NOT run `git add`/`commit`. Each "Checkpoint" states the commit message.
- **Internal operator UI is non-i18n** — hardcoded Portuguese, no `messages/pt-PT.json` keys.
- **This is the sanctioned PII surface.** Unlike sub-projects 1–2 (aggregates only), these procedures deliberately return individual student personal data — so **every one of them MUST call `ctx.audit(...)`** before returning. That audit record is the GDPR justification for the access.
- **Read-only.** No mutations in this sub-project. All procedures are `adminProcedure.query`.
- **No SSR prefetch for support queries.** Fetch client-side with `refetchOnWindowFocus: false` and `staleTime: 5 * 60_000`, so each deliberate view produces roughly one audit row rather than one per window-focus/refetch.
- **Validation:** Zod schemas import from `"zod/v4"`.
- **Zero-tolerance gates:** `pnpm type-check` and `pnpm lint` both pass before a task is done.

---

## File Structure

**Create:**
- `src/server/routers/admin/support.ts` — `listStudents` + `getStudent`, both audited
- `tests/admin-support.test.ts`
- `src/app/platform-admin/tenants/[tenantId]/students/page.tsx` — list (server shell)
- `src/app/platform-admin/tenants/[tenantId]/students/_components/students-list.tsx` — list (client)
- `src/app/platform-admin/tenants/[tenantId]/students/[studentId]/page.tsx` — detail (server shell)
- `src/app/platform-admin/tenants/[tenantId]/students/[studentId]/_components/student-detail.tsx` — detail (client)
- `src/app/platform-admin/_components/pii-notice.tsx` — the "access is logged" banner

**Modify:**
- `src/lib/validations/admin.ts` — support input schemas
- `src/server/routers/admin/index.ts` — mount `support`
- `src/app/platform-admin/tenants/[tenantId]/_components/account-detail.tsx` — enable the "Ver alunos" button as a link

---

# PHASE 1 — Support router

### Task 1: `support.listStudents`

**Files:**
- Create: `src/server/routers/admin/support.ts`
- Modify: `src/lib/validations/admin.ts`, `src/server/routers/admin/index.ts`
- Test: `tests/admin-support.test.ts`

**Interfaces:**
- Produces: `admin.support.listStudents(input) → { items: StudentRow[]; total: number }` where
  `StudentRow = { userId, membershipId, name, email, phone, status, activeCourses }`.
  Audits `student.list_view` (targetType `"tenant"`).
- Schema: `supportListStudentsSchema = { tenantId, schoolId?, page, pageSize, search? }`.

- [ ] **Step 1: Add validation schemas**

Append to `src/lib/validations/admin.ts`:

```ts
// --- Support view (sub-project 3) ---

export const supportListStudentsSchema = z.object({
  tenantId: z.string().uuid(),
  schoolId: z.string().uuid().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
});

export const supportGetStudentSchema = z.object({
  tenantId: z.string().uuid(),
  studentUserId: z.string().uuid(),
});
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/admin-support.test.ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createCallerFactory, type TRPCContext } from "@/server/trpc";
import { appRouter } from "@/server/routers/_app";
import { createTestTenant, cleanupTenants, type TestTenant } from "./helpers/tenant";

const createCaller = createCallerFactory(appRouter);
function adminCaller(email = "op@convlyx.com"): ReturnType<typeof createCaller> {
  const ctx: TRPCContext = {
    db, tenantId: null, ip: null, user: { id: "op" }, userEmail: email,
    loadMembership: async () => null,
  };
  return createCaller(ctx);
}

const originalEmails = process.env.PLATFORM_ADMIN_EMAILS;
let a: TestTenant;
beforeAll(async () => { process.env.PLATFORM_ADMIN_EMAILS = "op@convlyx.com"; a = await createTestTenant("SUP"); });
afterAll(async () => {
  if (originalEmails === undefined) delete process.env.PLATFORM_ADMIN_EMAILS;
  else process.env.PLATFORM_ADMIN_EMAILS = originalEmails;
  await cleanupTenants(a.tenantId);
});

describe("admin.support.listStudents", () => {
  it("lists students only, and audits the access", async () => {
    const res = await adminCaller().admin.support.listStudents({ tenantId: a.tenantId, page: 1, pageSize: 20 });
    expect(res.total).toBeGreaterThanOrEqual(1);
    expect(res.items.some((s) => s.userId === a.studentUserId)).toBe(true);
    // The seed's admin/instructor are NOT students.
    expect(res.items.every((s) => s.userId !== a.adminUserId && s.userId !== a.instructorUserId)).toBe(true);
    const audits = await db.auditLog.findMany({ where: { action: "student.list_view", targetId: a.tenantId } });
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });
  it("rejects a non-operator", async () => {
    await expect(adminCaller("nope@x.com").admin.support.listStudents({ tenantId: a.tenantId, page: 1, pageSize: 20 })).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run to verify fail**

Run: `pnpm vitest run tests/admin-support.test.ts`
Expected: FAIL — `admin.support` undefined.

- [ ] **Step 4: Implement `listStudents`**

```ts
// src/server/routers/admin/support.ts
import { TRPCError } from "@trpc/server";
import { router, adminProcedure } from "../../trpc";
import { supportListStudentsSchema, supportGetStudentSchema } from "@/lib/validations/admin";

export const supportRouter = router({
  listStudents: adminProcedure.input(supportListStudentsSchema).query(async ({ ctx, input }) => {
    const where = {
      tenantId: input.tenantId,
      role: "STUDENT" as const,
      ...(input.schoolId && { schoolId: input.schoolId }),
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: "insensitive" as const } },
              { user: { is: { email: { contains: input.search, mode: "insensitive" as const } } } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      ctx.db.membership.count({ where }),
      ctx.db.membership.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        select: { id: true, userId: true, name: true, phone: true, status: true, user: { select: { email: true } } },
      }),
    ]);

    const ids = rows.map((r) => r.userId);
    const courseAgg = ids.length
      ? await ctx.db.studentCourse.groupBy({
          by: ["studentId"],
          where: { tenantId: input.tenantId, studentId: { in: ids }, status: "IN_PROGRESS" },
          _count: { _all: true },
        })
      : [];
    const activeByStudent = new Map(courseAgg.map((r) => [r.studentId, r._count._all]));

    await ctx.audit({
      action: "student.list_view",
      targetType: "tenant",
      targetId: input.tenantId,
      metadata: { schoolId: input.schoolId ?? null, page: input.page, count: rows.length },
    });

    return {
      total,
      items: rows.map((r) => ({
        userId: r.userId,
        membershipId: r.id,
        name: r.name,
        email: r.user.email,
        phone: r.phone,
        status: r.status,
        activeCourses: activeByStudent.get(r.userId) ?? 0,
      })),
    };
  }),
});
```

Mount in `src/server/routers/admin/index.ts`: import `supportRouter`, add `support: supportRouter`.
(`TRPCError` + `supportGetStudentSchema` imports are used by Task 2 — add them now to avoid a second edit; they won't trip lint because Task 2 lands in the same file before any commit gate that matters. If running the gate between tasks, add `supportGetStudentSchema` import in Task 2 instead.)

- [ ] **Step 5: Run tests + gates**

Run: `pnpm vitest run tests/admin-support.test.ts && pnpm type-check && pnpm lint`
Expected: `listStudents` tests PASS. (Remove `supportGetStudentSchema`/`TRPCError` imports until Task 2 if lint flags unused.)

- [ ] **Step 6: Checkpoint**

Commit message: `feat(admin): support.listStudents (audited, cross-tenant)`

---

### Task 2: `support.getStudent`

**Files:**
- Modify: `src/server/routers/admin/support.ts`
- Test: extend `tests/admin-support.test.ts`

**Interfaces:**
- Produces: `admin.support.getStudent({ tenantId, studentUserId }) →`
  `{ profile: { userId, name, email, phone, status, joinedAt, qualifiedCategories, schoolName }, courses: {category,status,startedAt,completedAt}[], enrollments: {status,checkedInAt,enrolledAt,session:{title,startsAt,classType}}[], exams: {type,result,scheduledAt,category}[] }`.
  Audits `student.view_detail` (targetType `"user"`). Throws NOT_FOUND if the user isn't a STUDENT in that tenant.

- [ ] **Step 1: Write the failing test (append)**

```ts
describe("admin.support.getStudent", () => {
  it("returns profile + courses + enrolments and audits the detail view", async () => {
    const res = await adminCaller().admin.support.getStudent({ tenantId: a.tenantId, studentUserId: a.studentUserId });
    expect(res.profile.userId).toBe(a.studentUserId);
    expect(Array.isArray(res.courses)).toBe(true);
    expect(res.courses.length).toBeGreaterThanOrEqual(1); // seed has one course
    expect(res.enrollments.length).toBeGreaterThanOrEqual(1); // seed has one enrolment
    const audits = await db.auditLog.findMany({ where: { action: "student.view_detail", targetId: a.studentUserId } });
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });
  it("throws NOT_FOUND for a non-member / non-student", async () => {
    await expect(adminCaller().admin.support.getStudent({ tenantId: a.tenantId, studentUserId: a.adminUserId })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm vitest run tests/admin-support.test.ts`
Expected: FAIL — `getStudent` undefined.

- [ ] **Step 3: Implement `getStudent`**

Add to `supportRouter` (ensure `TRPCError` and `supportGetStudentSchema` are imported):

```ts
  getStudent: adminProcedure.input(supportGetStudentSchema).query(async ({ ctx, input }) => {
    const membership = await ctx.db.membership.findFirst({
      where: { tenantId: input.tenantId, userId: input.studentUserId, role: "STUDENT" },
      select: {
        name: true, phone: true, status: true, qualifiedCategories: true, createdAt: true,
        user: { select: { email: true } }, school: { select: { name: true } },
      },
    });
    if (!membership) throw new TRPCError({ code: "NOT_FOUND", message: "errors.notFound" });

    const [courses, enrollments, exams] = await Promise.all([
      ctx.db.studentCourse.findMany({
        where: { tenantId: input.tenantId, studentId: input.studentUserId },
        orderBy: { startedAt: "desc" },
        select: { category: true, status: true, startedAt: true, completedAt: true },
      }),
      ctx.db.enrollment.findMany({
        where: { tenantId: input.tenantId, studentId: input.studentUserId },
        orderBy: { enrolledAt: "desc" },
        take: 50,
        select: {
          status: true, checkedInAt: true, enrolledAt: true,
          session: { select: { title: true, startsAt: true, classType: true } },
        },
      }),
      ctx.db.exam.findMany({
        where: { tenantId: input.tenantId, course: { is: { studentId: input.studentUserId } } },
        orderBy: { scheduledAt: "desc" },
        select: { type: true, result: true, scheduledAt: true, course: { select: { category: true } } },
      }),
    ]);

    await ctx.audit({
      action: "student.view_detail",
      targetType: "user",
      targetId: input.studentUserId,
      metadata: { tenantId: input.tenantId },
    });

    return {
      profile: {
        userId: input.studentUserId,
        name: membership.name,
        email: membership.user.email,
        phone: membership.phone,
        status: membership.status,
        joinedAt: membership.createdAt,
        qualifiedCategories: membership.qualifiedCategories,
        schoolName: membership.school.name,
      },
      courses,
      enrollments,
      exams: exams.map((e) => ({ type: e.type, result: e.result, scheduledAt: e.scheduledAt, category: e.course.category })),
    };
  }),
```

- [ ] **Step 4: Run tests + gates**

Run: `pnpm vitest run tests/admin-support.test.ts && pnpm type-check && pnpm lint`
Expected: green.

- [ ] **Step 5: Checkpoint**

Commit message: `feat(admin): support.getStudent read-only detail (audited)`

---

# PHASE 2 — Support UI

### Task 3: Students list page + enable "Ver alunos"

**Files:**
- Create: `src/app/platform-admin/_components/pii-notice.tsx`, `src/app/platform-admin/tenants/[tenantId]/students/page.tsx`, `src/app/platform-admin/tenants/[tenantId]/students/_components/students-list.tsx`
- Modify: `src/app/platform-admin/tenants/[tenantId]/_components/account-detail.tsx`

**Interfaces:**
- Consumes: `admin.support.listStudents`.

- [ ] **Step 1: PII notice banner**

```tsx
// src/app/platform-admin/_components/pii-notice.tsx
import { ShieldAlert } from "lucide-react";

export function PiiNotice() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
      <p>A visualização de dados pessoais de alunos fica registada no registo de auditoria (quem, quando, qual grupo).</p>
    </div>
  );
}
```

- [ ] **Step 2: Students list client component**

```tsx
// src/app/platform-admin/tenants/[tenantId]/students/_components/students-list.tsx
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
        <Input value={searchInput} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Procurar por nome ou email…" className="w-[260px] pl-8" aria-label="Procurar aluno" />
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
                  <TableCell>{s.status === "ACTIVE" ? <span className="text-success">Ativo</span> : <span className="text-muted-foreground">Inativo</span>}</TableCell>
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
```

- [ ] **Step 3: Students list server page**

```tsx
// src/app/platform-admin/tenants/[tenantId]/students/page.tsx
import { StudentsList } from "./_components/students-list";

export const dynamic = "force-dynamic";

export default async function StudentsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return <StudentsList tenantId={tenantId} />;
}
```

- [ ] **Step 4: Enable "Ver alunos" on the account page**

In `account-detail.tsx`, add `Link` to the existing `next/link` import if not present (it is imported already), and replace the disabled button:

```tsx
          <Button asChild variant="outline" size="sm">
            <Link href={`/platform-admin/tenants/${tenantId}/students`}>Ver alunos</Link>
          </Button>
```

(If `Button` doesn't support `asChild`, use `<Link href=…><Button variant="outline" size="sm">Ver alunos</Button></Link>` — verify against `src/components/ui/button.tsx` and use whichever the component supports.)

- [ ] **Step 5: Gates + build**

Run: `pnpm type-check && pnpm lint && pnpm build`
Expected: clean; `/platform-admin/tenants/[tenantId]/students` compiles.

- [ ] **Step 6: Checkpoint**

Commit message: `feat(admin): students list support page + enable Ver alunos`

---

### Task 4: Student detail page

**Files:**
- Create: `src/app/platform-admin/tenants/[tenantId]/students/[studentId]/page.tsx`, `src/app/platform-admin/tenants/[tenantId]/students/[studentId]/_components/student-detail.tsx`

**Interfaces:**
- Consumes: `admin.support.getStudent`, `formatDate` from `admin-format`.

- [ ] **Step 1: Student detail client component**

```tsx
// src/app/platform-admin/tenants/[tenantId]/students/[studentId]/_components/student-detail.tsx
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
          <Badge variant={profile.status === "ACTIVE" ? "default" : "destructive"}>{profile.status === "ACTIVE" ? "Ativo" : "Inativo"}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {profile.email}{profile.phone ? ` · ${profile.phone}` : ""} · {profile.schoolName} · desde {formatDate(profile.joinedAt)}
        </p>
        {profile.qualifiedCategories.length > 0 && (
          <p className="text-sm text-muted-foreground">Categorias: {profile.qualifiedCategories.join(", ")}</p>
        )}
      </div>

      <ChartCard title="Cursos">
        {courses.length === 0 ? <EmptyState icon={Users} message="Sem cursos." /> : (
          <DataTableCard>
            <Table>
              <caption className="sr-only">Cursos do aluno</caption>
              <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead>Estado</TableHead><TableHead>Início</TableHead><TableHead>Conclusão</TableHead></TableRow></TableHeader>
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
        {enrollments.length === 0 ? <EmptyState icon={Users} message="Sem inscrições." /> : (
          <DataTableCard>
            <Table>
              <caption className="sr-only">Inscrições do aluno</caption>
              <TableHeader><TableRow><TableHead>Aula</TableHead><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Estado</TableHead><TableHead>Check-in</TableHead></TableRow></TableHeader>
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
        {exams.length === 0 ? <EmptyState icon={Users} message="Sem exames." /> : (
          <DataTableCard>
            <Table>
              <caption className="sr-only">Exames do aluno</caption>
              <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Categoria</TableHead><TableHead>Data</TableHead><TableHead>Resultado</TableHead></TableRow></TableHeader>
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
```

- [ ] **Step 2: Student detail server page**

```tsx
// src/app/platform-admin/tenants/[tenantId]/students/[studentId]/page.tsx
import { StudentDetail } from "./_components/student-detail";

export const dynamic = "force-dynamic";

export default async function StudentDetailPage({ params }: { params: Promise<{ tenantId: string; studentId: string }> }) {
  const { tenantId, studentId } = await params;
  return <StudentDetail tenantId={tenantId} studentUserId={studentId} />;
}
```

- [ ] **Step 3: Gates + build**

Run: `pnpm type-check && pnpm lint && pnpm build`
Expected: clean; `/platform-admin/tenants/[tenantId]/students/[studentId]` compiles.

- [ ] **Step 4: Checkpoint**

Commit message: `feat(admin): read-only student detail support page`

---

## Self-Review

**Spec coverage (§7 of the design, as amended to the console-rendered read-only view):**
- §7.1 Gated student lookup → Task 1 (`listStudents`, audited `student.list_view`) + Task 3 (list UI, PII banner).
- §7.1 individual-record view → Task 2 (`getStudent`, audited `student.view_detail`) + Task 4 (detail UI).
- §7.2 view-as → **descoped by decision (2026-07-14)** to a read-only console view (Tasks 2/4) instead of app impersonation, because impersonation would modify the shared auth path (`middleware`/`createTRPCContext`/`getDashboardUser`) that every live tenant user hits, and we can only test in prod. The audited read-only detail delivers the diagnostic value at zero auth-path risk. True impersonation remains specced for a future round once auth changes can be tested safely (e.g. dev credentials / a staging tenant).
- GDPR audit-on-access → every support procedure calls `ctx.audit` before returning; verified in Tasks 1–2 tests; UI shows the `PiiNotice` banner.

**Placeholder scan:** No TBD/TODO. Every step has concrete code or an exact command. The one conditional ("if `Button` supports `asChild`") is a verify-then-pick instruction with both concrete forms given, not a placeholder.

**Type consistency:** `listStudents` row shape (`userId`, `membershipId`, `name`, `email`, `phone`, `status`, `activeCourses`) matches the Task 3 table. `getStudent` return (`profile`/`courses`/`enrollments`/`exams`) matches the Task 4 render. Audit verbs (`student.list_view`, `student.view_detail`) are consistent between router and tests. Schemas `supportListStudentsSchema`/`supportGetStudentSchema` match the procedure inputs and the client `useQuery` inputs. `refetchOnWindowFocus: false` + `staleTime` applied on both PII queries per the audit-noise constraint.
```

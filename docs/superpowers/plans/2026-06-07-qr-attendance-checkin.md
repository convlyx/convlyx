# QR Code Attendance Check-in — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let students self-check-in to theory classes by scanning a rotating QR code the instructor displays, marking their `Enrollment` as `ATTENDED` in real time.

**Architecture:** A per-session HMAC secret backs a TOTP-style rotating token. The instructor opens a projector-friendly display screen (`/checkin-display/[id]`) that polls a fresh token and renders it as a QR. The student's native camera opens a deep link (`/checkin/[sessionId]?t=…`) to an authenticated confirm screen; one tap calls a tRPC mutation that validates the token + same-school eligibility and marks attendance (auto-enrolling walk-ins if capacity allows). An instructor banner links to the display when a theory class is in progress.

**Tech Stack:** Next.js 16 App Router, tRPC v11, Prisma 7, Zod v4, `qrcode`, next-intl (pt-PT), vitest. Node `crypto` for HMAC. Package manager: **pnpm**.

**Conventions for this plan**
- **Commits:** Francisco runs all git commits himself — each commit step provides the *message text* only; do not run `git add`/`git commit`.
- **Verification gates:** `pnpm type-check` and `pnpm lint` must both pass before any task is considered done.
- **No hardcoded strings:** every user-facing string is an i18n key in `messages/pt-PT.json` (pt-PT, never pt-BR).
- **Tenant scope:** never use `findUnique`/`findUniqueOrThrow` on tenant-scoped models — use `findFirst`. The `protectedProcedure` db client auto-merges `tenantId`.

---

## File Structure

**Create:**
- `src/server/lib/checkin-token.ts` — pure HMAC token gen/verify (no DB, no `@/` imports).
- `src/server/lib/checkin-token.test.ts` — vitest unit tests for the token util.
- `src/lib/validations/checkin.ts` — Zod schemas for the new procedures.
- `src/app/checkin-display/[id]/page.tsx` — instructor display (Server Component, auth guard).
- `src/app/checkin-display/[id]/_components/checkin-display.tsx` — client: polls token, renders QR + live count + open/close.
- `src/app/checkin/[sessionId]/page.tsx` — student confirm (Server Component, auth guard).
- `src/app/checkin/[sessionId]/_components/checkin-confirm.tsx` — client: confirm button + result states.
- `src/app/(dashboard)/_components/current-class-banner.tsx` — instructor banner.

**Modify:**
- `prisma/schema.prisma` — add `checkInOpenedAt`, `checkInSecret` to `ClassSession`; `checkedInAt` to `Enrollment`.
- `src/server/routers/class.ts` — add `openCheckIn`, `closeCheckIn`, `getCheckInToken`.
- `src/server/routers/enrollment.ts` — add `checkIn`.
- `messages/pt-PT.json` — add `checkin.*` keys.
- `src/app/(dashboard)/_components/instructor-home.tsx` — render `<CurrentClassBanner />`.
- `FEATURES.md` — document the feature.

---

## Task 1: Schema + migration

**Files:**
- Modify: `prisma/schema.prisma` (`ClassSession` ~line 195, `Enrollment` ~line 222)

- [ ] **Step 1: Add fields to `ClassSession`**

In `model ClassSession`, after the `status` line, add:

```prisma
  // QR self-check-in window. checkInOpenedAt non-null ⇒ window open; the
  // secret backs the rotating QR token and is cleared on close to invalidate it.
  checkInOpenedAt DateTime? @map("check_in_opened_at")
  checkInSecret   String?   @map("check_in_secret")
```

- [ ] **Step 2: Add field to `Enrollment`**

In `model Enrollment`, after the `notes` line, add:

```prisma
  checkedInAt DateTime? @map("checked_in_at") // set on QR self-check-in
```

- [ ] **Step 3: Create the migration**

Run: `pnpm db:migrate -- --name add_checkin_fields`
Expected: a new folder `prisma/migrations/<timestamp>_add_checkin_fields/migration.sql` containing three `ALTER TABLE … ADD COLUMN` statements; Prisma client regenerated.

> **If `migrate dev` errors with drift/checksum** (a pending per-school-timezone migration is ahead of this one — see project memory): do NOT force-reset. Instead author the migration folder + `migration.sql` by hand following the manual workflow in `CLAUDE.md` ("Database Migrations"), then run `pnpm db:generate`. The SQL is exactly:
> ```sql
> ALTER TABLE "class_sessions" ADD COLUMN "check_in_opened_at" TIMESTAMP(3);
> ALTER TABLE "class_sessions" ADD COLUMN "check_in_secret" TEXT;
> ALTER TABLE "enrollments" ADD COLUMN "checked_in_at" TIMESTAMP(3);
> ```

- [ ] **Step 4: Verify**

Run: `pnpm type-check`
Expected: PASS (Prisma client now knows the new fields).

- [ ] **Step 5: Commit** — message: `feat(checkin): add QR check-in fields to schema`

> **Prod note:** this migration must be hand-applied via the Supabase SQL Editor + recorded in `_prisma_migrations` (prod auto-migrate is disabled). Flag to Francisco at the end; do not attempt prod apply.

---

## Task 2: Token utility (TDD)

**Files:**
- Create: `src/server/lib/checkin-token.ts`
- Test: `src/server/lib/checkin-token.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  generateSecret,
  currentToken,
  verifyToken,
  CHECKIN_WINDOW_MS,
} from "./checkin-token";

const SESSION = "11111111-1111-1111-1111-111111111111";

describe("checkin-token", () => {
  it("generates a non-empty hex secret", () => {
    const s = generateSecret();
    expect(s).toMatch(/^[0-9a-f]+$/);
    expect(s.length).toBeGreaterThanOrEqual(32);
  });

  it("accepts a token within the current window", () => {
    const secret = generateSecret();
    const now = 1_000_000_000_000;
    const token = currentToken(secret, SESSION, now);
    expect(verifyToken(secret, SESSION, token, now)).toBe(true);
  });

  it("accepts a token from a recent (tolerated) past window", () => {
    const secret = generateSecret();
    const now = 1_000_000_000_000;
    const token = currentToken(secret, SESSION, now);
    // 2 windows later — still inside tolerance
    expect(verifyToken(secret, SESSION, token, now + CHECKIN_WINDOW_MS * 2)).toBe(true);
  });

  it("rejects a token older than the tolerance", () => {
    const secret = generateSecret();
    const now = 1_000_000_000_000;
    const token = currentToken(secret, SESSION, now);
    expect(verifyToken(secret, SESSION, token, now + CHECKIN_WINDOW_MS * 10)).toBe(false);
  });

  it("rejects a forged token", () => {
    const secret = generateSecret();
    const now = 1_000_000_000_000;
    expect(verifyToken(secret, SESSION, "deadbeef", now)).toBe(false);
  });

  it("rejects a token signed for a different session", () => {
    const secret = generateSecret();
    const now = 1_000_000_000_000;
    const token = currentToken(secret, "22222222-2222-2222-2222-222222222222", now);
    expect(verifyToken(secret, SESSION, token, now)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- checkin-token`
Expected: FAIL — `Cannot find module './checkin-token'`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** QR token rotation window. ~20s keeps a shared screenshot stale quickly. */
export const CHECKIN_WINDOW_MS = 20_000;
/** Past windows still accepted, to cover scan→tap delay (~80s back). */
const TOLERANCE_WINDOWS = 4;

export function generateSecret(): string {
  return randomBytes(32).toString("hex");
}

function windowIndex(nowMs: number): number {
  return Math.floor(nowMs / CHECKIN_WINDOW_MS);
}

function sign(secret: string, sessionId: string, index: number): string {
  return createHmac("sha256", secret)
    .update(`${sessionId}:${index}`)
    .digest("hex")
    .slice(0, 16);
}

export function currentToken(secret: string, sessionId: string, nowMs: number): string {
  return sign(secret, sessionId, windowIndex(nowMs));
}

export function verifyToken(
  secret: string,
  sessionId: string,
  token: string,
  nowMs: number,
): boolean {
  if (!token || !/^[0-9a-f]+$/.test(token)) return false;
  const current = windowIndex(nowMs);
  for (let i = 0; i <= TOLERANCE_WINDOWS; i++) {
    const expected = sign(secret, sessionId, current - i);
    if (
      expected.length === token.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(token))
    ) {
      return true;
    }
  }
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- checkin-token`
Expected: PASS (6 tests).

> If vitest cannot find the test (no config), it still discovers `*.test.ts` by default. The util uses only relative imports + `node:crypto`, so no `@/` alias config is needed.

- [ ] **Step 5: Commit** — message: `feat(checkin): add rotating HMAC token utility`

---

## Task 3: Validation schemas

**Files:**
- Create: `src/lib/validations/checkin.ts`

- [ ] **Step 1: Write schemas**

```ts
import { z } from "zod/v4";

export const checkInSessionSchema = z.object({
  sessionId: z.string().uuid(),
});

export const checkInTokenSchema = z.object({
  sessionId: z.string().uuid(),
});

export const studentCheckInSchema = z.object({
  sessionId: z.string().uuid(),
  token: z.string().min(1).max(64),
});

export type CheckInSessionInput = z.infer<typeof checkInSessionSchema>;
export type StudentCheckInInput = z.infer<typeof studentCheckInSchema>;
```

- [ ] **Step 2: Verify** — Run: `pnpm type-check` → PASS.
- [ ] **Step 3: Commit** — message: `feat(checkin): add validation schemas`

---

## Task 4: Instructor procedures (`openCheckIn`, `closeCheckIn`, `getCheckInToken`)

**Files:**
- Modify: `src/server/routers/class.ts` (imports at top; add procedures before the closing `});` of `classRouter`)

- [ ] **Step 1: Add imports** at the top of `class.ts` (after existing imports):

```ts
import {
  checkInSessionSchema,
  checkInTokenSchema,
} from "@/lib/validations/checkin";
import { generateSecret, currentToken, CHECKIN_WINDOW_MS } from "../lib/checkin-token";
```

- [ ] **Step 2: Add `openCheckIn`** inside `classRouter`:

```ts
  /** Open the QR self-check-in window for a theory class (instructor/staff). */
  openCheckIn: roleProtectedProcedure(["ADMIN", "SECRETARY", "INSTRUCTOR"])
    .input(checkInSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.classSession.findFirst({
        where: {
          id: input.sessionId,
          tenantId: ctx.tenantId,
          ...(ctx.user.role === "INSTRUCTOR" && { instructorId: ctx.user.id }),
        },
        select: { id: true, classType: true, status: true },
      });
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "classes.notFound" });
      }
      if (session.classType !== "THEORY") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "checkin.notTheory" });
      }
      if (session.status === "CANCELLED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "checkin.classCancelled" });
      }
      await ctx.db.classSession.update({
        where: { id: session.id },
        data: {
          checkInOpenedAt: new Date(),
          checkInSecret: generateSecret(),
          status: "IN_PROGRESS",
          updatedById: ctx.user.id,
        },
      });
      return { success: true };
    }),
```

- [ ] **Step 3: Add `closeCheckIn`**:

```ts
  /** Close the check-in window — clears the secret so all live QRs die. */
  closeCheckIn: roleProtectedProcedure(["ADMIN", "SECRETARY", "INSTRUCTOR"])
    .input(checkInSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.classSession.findFirst({
        where: {
          id: input.sessionId,
          tenantId: ctx.tenantId,
          ...(ctx.user.role === "INSTRUCTOR" && { instructorId: ctx.user.id }),
        },
        select: { id: true },
      });
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "classes.notFound" });
      }
      await ctx.db.classSession.update({
        where: { id: session.id },
        data: { checkInOpenedAt: null, checkInSecret: null, updatedById: ctx.user.id },
      });
      return { success: true };
    }),
```

- [ ] **Step 4: Add `getCheckInToken`** (polled by the display):

```ts
  /**
   * Current QR token + live check-in state for the display screen. Polled
   * client-side every ~windowMs. The secret never leaves the server — only the
   * derived, short-lived token does.
   */
  getCheckInToken: roleProtectedProcedure(["ADMIN", "SECRETARY", "INSTRUCTOR"])
    .input(checkInTokenSchema)
    .query(async ({ ctx, input }) => {
      const session = await ctx.db.classSession.findFirst({
        where: {
          id: input.sessionId,
          tenantId: ctx.tenantId,
          ...(ctx.user.role === "INSTRUCTOR" && { instructorId: ctx.user.id }),
        },
        select: {
          id: true,
          title: true,
          capacity: true,
          checkInOpenedAt: true,
          checkInSecret: true,
          enrollments: {
            where: { checkedInAt: { not: null } },
            select: { id: true, checkedInAt: true, student: { select: { name: true } } },
            orderBy: { checkedInAt: "desc" },
          },
        },
      });
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "classes.notFound" });
      }
      const checkInOpen = Boolean(session.checkInOpenedAt && session.checkInSecret);
      const token =
        checkInOpen && session.checkInSecret
          ? currentToken(session.checkInSecret, session.id, Date.now())
          : null;
      return {
        title: session.title,
        capacity: session.capacity,
        checkInOpen,
        token,
        windowMs: CHECKIN_WINDOW_MS,
        attendedCount: session.enrollments.length,
        recentCheckIns: session.enrollments
          .slice(0, 8)
          .map((e) => ({ id: e.id, name: e.student.name, checkedInAt: e.checkedInAt })),
      };
    }),
```

- [ ] **Step 5: Verify** — Run: `pnpm type-check` → PASS. Run: `pnpm lint` → PASS.
- [ ] **Step 6: Commit** — message: `feat(checkin): add instructor open/close/token procedures`

---

## Task 5: Student `checkIn` procedure

**Files:**
- Modify: `src/server/routers/enrollment.ts`

- [ ] **Step 1: Add imports** at the top of `enrollment.ts`:

```ts
import { studentCheckInSchema } from "@/lib/validations/checkin";
import { verifyToken } from "../lib/checkin-token";
```

- [ ] **Step 2: Add `checkIn`** inside `enrollmentRouter`:

```ts
  /**
   * Student self-check-in via the instructor's rotating QR. Validates the
   * token + same-school eligibility, marks ATTENDED (idempotent), and
   * auto-enrolls walk-ins when capacity allows. Theory classes only.
   */
  checkIn: roleProtectedProcedure(["STUDENT"])
    .input(studentCheckInSchema)
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.classSession.findFirst({
        where: { id: input.sessionId, tenantId: ctx.tenantId },
        select: {
          id: true,
          title: true,
          classType: true,
          schoolId: true,
          capacity: true,
          checkInOpenedAt: true,
          checkInSecret: true,
          _count: { select: { enrollments: true } },
        },
      });
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "classes.notFound" });
      }
      if (session.classType !== "THEORY") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "checkin.notTheory" });
      }
      if (session.schoolId !== ctx.user.schoolId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "checkin.differentSchool" });
      }
      if (!session.checkInOpenedAt || !session.checkInSecret) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "checkin.windowClosed" });
      }
      if (!verifyToken(session.checkInSecret, session.id, input.token, Date.now())) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "checkin.tokenExpired" });
      }

      const existing = await ctx.db.enrollment.findFirst({
        where: { sessionId: session.id, studentId: ctx.user.id },
        select: { id: true, status: true },
      });

      if (existing) {
        if (existing.status === "ATTENDED") {
          return { success: true, title: session.title, alreadyMarked: true };
        }
        await ctx.db.enrollment.update({
          where: { id: existing.id },
          data: { status: "ATTENDED", checkedInAt: new Date() },
        });
        return { success: true, title: session.title, alreadyMarked: false };
      }

      // Walk-in: auto-enroll if there is room.
      if (session._count.enrollments >= session.capacity) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "enrollments.classFull" });
      }
      await ctx.db.enrollment.create({
        data: {
          tenantId: ctx.tenantId,
          schoolId: session.schoolId,
          sessionId: session.id,
          studentId: ctx.user.id,
          status: "ATTENDED",
          checkedInAt: new Date(),
        },
      });
      return { success: true, title: session.title, alreadyMarked: false };
    }),
```

- [ ] **Step 3: Verify** — Run: `pnpm type-check` → PASS. Run: `pnpm lint` → PASS.
- [ ] **Step 4: Commit** — message: `feat(checkin): add student self-check-in procedure`

---

## Task 6: i18n keys

**Files:**
- Modify: `messages/pt-PT.json`

- [ ] **Step 1: Add a `checkin` namespace** (top-level key, pt-PT). Mirror existing nesting style:

```json
"checkin": {
  "notTheory": "A marcação por QR só está disponível em aulas teóricas.",
  "classCancelled": "Esta aula foi cancelada.",
  "windowClosed": "A marcação de presença está fechada.",
  "tokenExpired": "O código QR expirou. Por favor, leia novamente o código.",
  "differentSchool": "Esta aula pertence a outra escola.",
  "displayTitle": "Marcação de presença",
  "openCheckIn": "Abrir marcação",
  "closeCheckIn": "Fechar marcação",
  "scanToCheckIn": "Aponta a câmara do telemóvel para o código para marcares presença.",
  "presentCount": "{count} de {capacity} presentes",
  "windowClosedHint": "Marcação fechada. Abre a marcação para mostrar o código.",
  "confirmTitle": "Confirmar presença",
  "confirmButton": "Confirmar presença",
  "confirmHint": "Vais marcar presença nesta aula.",
  "marked": "Presença marcada",
  "alreadyMarked": "A tua presença já estava registada.",
  "bannerInProgress": "Aula a decorrer",
  "bannerAction": "Abrir marcação de presença",
  "recentCheckIns": "Marcações recentes"
}
```

> Also add any class-error keys referenced but missing (`classes.notFound`, `enrollments.classFull` already exist — verify with a search; only add what's missing).

- [ ] **Step 2: Verify** — Run: `pnpm type-check` → PASS (JSON is type-checked via next-intl augmentation if present; otherwise just ensure valid JSON).
- [ ] **Step 3: Commit** — message: `feat(checkin): add pt-PT strings`

---

## Task 7: Instructor display screen

**Files:**
- Create: `src/app/checkin-display/[id]/page.tsx`
- Create: `src/app/checkin-display/[id]/_components/checkin-display.tsx`

Placed outside `(dashboard)` so it renders full-screen without the mobile tab bar / sidebar — ideal for a projector. Still authenticated via `requireDashboardUser`.

- [ ] **Step 1: Page (Server Component, auth guard)**

```tsx
import { requireDashboardUser } from "@/server/dashboard-user";
import { CheckInDisplay } from "./_components/checkin-display";

export default async function CheckInDisplayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireDashboardUser(["ADMIN", "SECRETARY", "INSTRUCTOR"]);
  const { id } = await params;
  return <CheckInDisplay sessionId={id} />;
}
```

- [ ] **Step 2: Client display component**

Mirror `install-qr.tsx` for the QR-canvas pattern (build the URL from `window.location`, render to `<canvas>` via `QRCode.toCanvas`). Key behaviour:
- `const { data, refetch } = trpc.class.getCheckInToken.useQuery({ sessionId }, { refetchInterval: data?.windowMs ?? 20000 })` — poll on the window cadence.
- `openMutation = trpc.class.openCheckIn.useMutation({ onSuccess: () => refetch() })`, `closeMutation = trpc.class.closeCheckIn.useMutation({ onSuccess: () => refetch() })`.
- When `data.checkInOpen && data.token`, draw QR for `${window.location.protocol}//${window.location.host}/checkin/${sessionId}?t=${data.token}` at a large width (e.g. 360). Redraw whenever `data.token` changes.
- Show `t("checkin.presentCount", { count: data.attendedCount, capacity: data.capacity })`, a big Abrir/Fechar button (`checkin.openCheckIn` / `checkin.closeCheckIn`), and the `data.recentCheckIns` names list under `checkin.recentCheckIns`.
- All strings via `useTranslations("checkin")`. Theme tokens only.

```tsx
"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

export function CheckInDisplay({ sessionId }: { sessionId: string }) {
  const t = useTranslations("checkin");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const { data, refetch } = trpc.class.getCheckInToken.useQuery(
    { sessionId },
    { refetchInterval: 20000 },
  );
  const open = trpc.class.openCheckIn.useMutation({ onSuccess: () => refetch() });
  const close = trpc.class.closeCheckIn.useMutation({ onSuccess: () => refetch() });

  useEffect(() => {
    if (!canvasRef.current || !data?.checkInOpen || !data.token) return;
    const url = `${window.location.protocol}//${window.location.host}/checkin/${sessionId}?t=${data.token}`;
    QRCode.toCanvas(canvasRef.current, url, { width: 360, margin: 1 }).catch(() => {});
  }, [data?.token, data?.checkInOpen, sessionId]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-2xl font-bold">{data?.title ?? t("displayTitle")}</h1>
      {data?.checkInOpen ? (
        <>
          <div className="rounded-2xl border bg-white p-6">
            <canvas ref={canvasRef} />
          </div>
          <p className="text-muted-foreground">{t("scanToCheckIn")}</p>
          <p className="text-3xl font-bold">
            {t("presentCount", { count: data.attendedCount, capacity: data.capacity })}
          </p>
          <Button size="lg" variant="outline" onClick={() => close.mutate({ sessionId })}>
            {t("closeCheckIn")}
          </Button>
          {data.recentCheckIns.length > 0 && (
            <ul className="text-sm text-muted-foreground">
              {data.recentCheckIns.map((c) => (
                <li key={c.id}>{c.name}</li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <p className="text-muted-foreground">{t("windowClosedHint")}</p>
          <Button size="lg" onClick={() => open.mutate({ sessionId })}>
            {t("openCheckIn")}
          </Button>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Verify** — Run: `pnpm type-check` → PASS. Run: `pnpm lint` → PASS.
- [ ] **Step 4: Commit** — message: `feat(checkin): add instructor display screen`

---

## Task 8: Student confirm screen + login return

**Files:**
- Create: `src/app/checkin/[sessionId]/page.tsx`
- Create: `src/app/checkin/[sessionId]/_components/checkin-confirm.tsx`
- Modify: login flow to honour a `next` redirect param (read `src/app/(auth)/login/**` during execution to match its actual shape).

- [ ] **Step 1: Page (Server Component, auth guard with return-to)**

`requireDashboardUser` redirects to `/login` with no return path. For the deep-link UX, guard manually so we can pass `next`:

```tsx
import { redirect } from "next/navigation";
import { getDashboardUser } from "@/server/dashboard-user";
import { CheckInConfirm } from "./_components/checkin-confirm";

export default async function CheckInPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { sessionId } = await params;
  const { t } = await searchParams;
  const user = await getDashboardUser();
  if (!user) {
    const next = encodeURIComponent(`/checkin/${sessionId}${t ? `?t=${t}` : ""}`);
    redirect(`/login?next=${next}`);
  }
  return <CheckInConfirm sessionId={sessionId} token={t ?? ""} />;
}
```

- [ ] **Step 2: Confirm client component**

```tsx
"use client";

import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

export function CheckInConfirm({ sessionId, token }: { sessionId: string; token: string }) {
  const t = useTranslations("checkin");
  const { data: cls } = trpc.class.getById.useQuery({ id: sessionId });
  const checkIn = trpc.enrollment.checkIn.useMutation();

  if (checkIn.isSuccess) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <CheckCircle className="h-16 w-16 text-emerald-500" />
        <h1 className="text-xl font-bold">{t("marked")}</h1>
        {checkIn.data.alreadyMarked && (
          <p className="text-muted-foreground">{t("alreadyMarked")}</p>
        )}
        <p className="font-medium">{checkIn.data.title}</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-bold">{t("confirmTitle")}</h1>
      {cls && <p className="text-lg font-medium">{cls.title}</p>}
      <p className="text-muted-foreground">{t("confirmHint")}</p>
      <Button
        size="lg"
        disabled={checkIn.isPending}
        onClick={() => checkIn.mutate({ sessionId, token })}
      >
        {t("confirmButton")}
      </Button>
      {checkIn.error && (
        <p className="text-sm text-destructive">{t(checkIn.error.message.replace("checkin.", ""))}</p>
      )}
    </main>
  );
}
```

> The error rendering above assumes `checkin.*` message keys; during execution, follow the existing tRPC `onError`/toast convention in the codebase (search for how other client components surface `error.message` i18n keys) and match it rather than hand-rolling. Replace the inline `<p>` if there is a shared toast helper.

- [ ] **Step 3: Login `next` support** — read the login page/form; after a successful login, if `next` is a safe relative path (starts with `/`, no `//`), redirect there instead of `/`. Add an i18n-free guard; no user-facing strings change.

- [ ] **Step 4: Verify** — Run: `pnpm type-check` → PASS. Run: `pnpm lint` → PASS.
- [ ] **Step 5: Commit** — message: `feat(checkin): add student confirm screen + login return`

---

## Task 9: Instructor banner

**Files:**
- Create: `src/app/(dashboard)/_components/current-class-banner.tsx`
- Modify: `src/app/(dashboard)/_components/instructor-home.tsx`

- [ ] **Step 1: Banner component** — query the instructor's classes for today (reuse `trpc.class.list`), find a THEORY class with `status === "IN_PROGRESS"`, and link to `/checkin-display/[id]`.

```tsx
"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Radio } from "lucide-react";
import { trpc } from "@/lib/trpc";

export function CurrentClassBanner({ todayRange }: { todayRange: { from: string; to: string } }) {
  const t = useTranslations("checkin");
  const { data } = trpc.class.list.useQuery(todayRange);
  const current = data?.items.find(
    (c) => c.classType === "THEORY" && c.status === "IN_PROGRESS",
  );
  if (!current) return null;
  return (
    <Link
      href={`/checkin-display/${current.id}`}
      className="flex items-center gap-3 rounded-2xl border border-primary bg-primary/5 p-4 transition-all hover:card-shadow-hover"
    >
      <Radio className="h-5 w-5 text-primary" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{t("bannerInProgress")} · {current.title}</p>
        <p className="text-xs text-primary font-medium">{t("bannerAction")}</p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Render it** in `instructor-home.tsx` — import and place `<CurrentClassBanner todayRange={todayRange} />` directly under `<PendingAttendanceModal />` (line ~61). `todayRange` is already a prop of `InstructorHome`.

- [ ] **Step 3: Verify** — Run: `pnpm type-check` → PASS. Run: `pnpm lint` → PASS.
- [ ] **Step 4: Commit** — message: `feat(checkin): add in-progress class banner`

---

## Task 10: Docs + manual verification

**Files:**
- Modify: `FEATURES.md`

- [ ] **Step 1: Document the feature** in `FEATURES.md` under the relevant section (attendance / classes): one entry describing QR self-check-in for theory classes (rotating QR, instructor-controlled window, auto-enroll walk-ins, same-school only).

- [ ] **Step 2: Manual end-to-end check** on `demo.localhost:3000` (tenant subdomains don't resolve on `*.vercel.app`):
  1. As instructor: open a THEORY class in progress → banner appears → open `/checkin-display/[id]` → "Abrir marcação" → QR renders and refreshes ~every 20s.
  2. As a student of the same school (separate browser/profile): scan (or open the encoded URL) → confirm screen → "Confirmar presença" → success; instructor counter increments.
  3. Re-scan as same student → "alreadyMarked" success (idempotent).
  4. Close the window → a stale URL now shows `checkin.windowClosed`.
  5. Student of a different school → `checkin.differentSchool`.

- [ ] **Step 3: Final verify** — Run: `pnpm test` → PASS. Run: `pnpm type-check` → PASS. Run: `pnpm lint` → PASS. Run: `pnpm build` → PASS.

- [ ] **Step 4: Commit** — message: `docs(checkin): document QR attendance in FEATURES.md`

- [ ] **Step 5: Prod migration reminder** — surface to Francisco: the Task 1 migration (`add_checkin_fields`) must be hand-applied to prod via the Supabase SQL Editor and recorded in `_prisma_migrations` (auto-migrate is disabled).

---

## Self-Review notes

- **Spec coverage:** rotating token (T2), same-school + auto-enroll + idempotent (T5), instructor open/close window (T4), display + rotating QR (T7), student confirm deep link + login return (T8), banner (T9), pt-PT strings (T6), tests for token (T2). All spec sections map to a task.
- **Type consistency:** `getCheckInToken` returns `{ title, capacity, checkInOpen, token, windowMs, attendedCount, recentCheckIns }` — consumed verbatim in T7. `checkIn` returns `{ success, title, alreadyMarked }` — consumed in T8. Schemas in `checkin.ts` (`sessionId`, `token`) match procedure inputs.
- **Open risks flagged inline:** `migrate dev` drift (T1), no shared client error-toast convention assumed (T8 note), login `next` shape unknown until read (T8).
```

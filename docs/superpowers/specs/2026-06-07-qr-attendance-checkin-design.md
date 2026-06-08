# QR Code Attendance Check-in — Design Spec

**Date:** 2026-06-07
**Status:** Approved — ready for implementation
**Scope:** Theory classes only (`ClassType.THEORY`)

## Problem

Today attendance is marked manually, post-class, by an instructor/staff member via the
`PendingAttendanceModal` (sets `Enrollment.status` to `ATTENDED` / `NO_SHOW`). For theory
classes with 20–30 students this is slow and error-prone. We want students to self-check-in by
scanning a QR code the instructor displays at the front of the room.

## Key framing decisions

- **No "backoffice vs app" split is built.** The product is already a single responsive Next.js
  app under `(dashboard)` with role-based home screens and a mobile shell. Instructors already
  have full access on every device. We add two focused screens, not a new app surface.
- Self-check-in **coexists** with the existing post-class attendance modal. Scans mark `ATTENDED`
  live; the modal still surfaces whoever never checked in so staff can mark `NO_SHOW`.

## Approved decisions

| Decision | Choice |
| --- | --- |
| Anti-fraud | **Rotating QR** — short-lived signed token, refreshes ~20s |
| Non-enrolled scanner | **Auto-enroll + mark present** if capacity allows; else reject ("turma cheia") |
| Check-in window | **Instructor opens/closes manually** (also flips class to `IN_PROGRESS`) |
| Student scan UX | **Scan → confirm screen → one tap** (native camera opens a deep link) |
| Eligibility | **Same school only** within the tenant; reject otherwise |

## End-to-end flow

1. Instructor with an in-progress THEORY class sees an **"Aula a decorrer — Abrir marcação de
   presença"** banner → opens the check-in display screen.
2. Taps **"Abrir marcação"** → class flips to `IN_PROGRESS`, server generates a per-session
   secret, the screen shows a **large QR that refreshes every ~20s**.
3. Student points their **native phone camera** at the QR → opens
   `https://{tenant}.convlyx.com/checkin/{sessionId}?t={token}` → app shows a **"Confirmar
   presença"** card with the class name → one tap.
4. Server validates token + eligibility → marks `ATTENDED` (auto-enrolls walk-ins if capacity
   allows) → student sees **"Presença marcada ✓"**; instructor's live counter ticks up
   (**"12 de 20 presentes"**).
5. Instructor taps **"Fechar marcação"** → secret cleared, further scans rejected.

## Data model (new migration)

`ClassSession`:
- `checkInOpenedAt DateTime?` — non-null ⇒ window open.
- `checkInSecret String?` — random secret generated on open, cleared on close (closing
  invalidates all live QRs).

`Enrollment`:
- `checkedInAt DateTime?` — set on self-check-in; distinguishes QR check-ins from manual marking
  and feeds the live counter.

> **Prod migration is manual.** Per CLAUDE.md the prod auto-migrate is disabled — the migration
> `.sql` must be hand-applied via the Supabase SQL Editor and recorded in `_prisma_migrations`.
> There is already a pending prod migration (per-school timezone) ahead of this one.

## Security model (rotating token)

- **Stateless HMAC, TOTP-style:** `token = HMAC(checkInSecret, `${sessionId}:${timeWindow}`)`,
  window ≈ 20s.
- Server validates the scanned token against the **current ± N windows** (~60–90s tolerance, to
  cover the scan→tap delay). A screenshot shared later is dead; closing the window kills it
  immediately. Tolerance is tunable.
- The **secret never reaches the browser.** The display screen polls `getCheckInToken` for the
  freshly-rendered token + live count.

## API (tRPC, role-checked)

- `class.openCheckIn({ sessionId })` — INSTRUCTOR (own class) / ADMIN / SECRETARY; rejects
  non-THEORY classes; sets `checkInOpenedAt`, generates `checkInSecret`, sets `IN_PROGRESS`.
- `class.closeCheckIn({ sessionId })` — clears `checkInOpenedAt` + `checkInSecret`.
- `class.getCheckInToken({ sessionId })` — display polls this; returns
  `{ token, windowMs, checkInOpen, attendedCount, capacity, recentCheckIns }`.
- `enrollment.checkIn({ sessionId, token })` — STUDENT: validates window + token + same-school
  eligibility; marks `ATTENDED` + `checkedInAt`; auto-enrolls if not enrolled and capacity allows;
  idempotent on re-scan.
- Confirm screen reads class title/time/instructor for display via a lightweight query before the tap.

## UI

- **Instructor display** — `/classes/[id]/checkin`, minimal full-screen layout (no nav chrome,
  projector-friendly): class title, large high-contrast rotating QR, live "X de Y presentes" +
  recent names, Abrir/Fechar button. Reuses the `qrcode` lib.
- **Student confirm** — `/checkin/[sessionId]`, authenticated: class card + "Confirmar presença".
  Handles not-logged-in (login then return), window closed, QR expired, turma cheia, already-marked.
- **Instructor banner** — on instructor home + global, shown when they have a THEORY class in
  progress (now ∈ [startsAt − grace, endsAt]).

## Error handling (all PT-PT, i18n keys)

- QR expirado → re-scan prompt
- Marcação de presença fechada
- Turma cheia
- Presença já registada ✓
- Não autenticado → login com retorno (returnTo deep link)
- Aula não é teórica → openCheckIn rejeitado
- Escola diferente → rejeitado

## Testing

- **Token util:** generate/validate, window tolerance, expiry past tolerance, forged token rejected.
- **tRPC:** `openCheckIn` role checks (instructor own class only, non-THEORY rejected); `checkIn`
  enrolled vs walk-in vs capacity-full vs closed-window vs stale-token vs different-school;
  idempotent re-scan.

## Phasing

- **MVP:** everything above.
- **Phase 2 (optional):** push "Marcação aberta" to enrolled students; student-side banner;
  attendance-source analytics.

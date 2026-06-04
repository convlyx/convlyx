# Per-School Timezone — Decisions

**Date:** 2026-06-04
**Context:** The app hardcoded `Europe/Lisbon` for both wall-clock→UTC conversion on input and UTC→wall-clock formatting on output. Correct for mainland Portugal and Madeira, but **wrong for the Azores** (UTC−1 winter / UTC+0 summer — one hour behind Lisbon). Because input and output shared the same Lisbon transform, the displayed label looked self-consistent, but the **stored UTC instant was an hour off** for Azores schools, corrupting every time-relative behaviour (auto status, reminders, cancellation windows).

## Decisions

### D1 — `timeZone` column on `School`, set at creation only
`School.timeZone String @default("Europe/Lisbon")` (migration `20260604193700_add_school_time_zone`). Default keeps all existing schools behaving identically — no data migration. Allowed values constrained at the app layer to `SCHOOL_TIME_ZONES = ["Europe/Lisbon", "Atlantic/Madeira", "Atlantic/Azores"]` (`src/lib/validations/school.ts`).

The zone is chosen **at school creation** — platform-admin REST `POST /api/platform-admin/schools` (operator UI) and the in-tenant `school.create` / `createSchoolSchema` dialog — and is **intentionally not editable afterwards** (removed from Settings). Rationale: changing a live school's zone would shift the wall-clock of every already-stored class/exam (their UTC instants don't move). Correcting an existing school's zone is therefore a deliberate DB update, not a self-service toggle.

### D2 — Fix input first; time-relative jobs follow for free
Wall-clock→UTC conversion now takes the **target class/exam's** school zone (`wallClockToISO`/`wallClockToUTC` in `src/lib/dates.ts`, consolidated from a former duplicate in `class.ts`). Once the stored instant is the true UTC, the auto-status cron (`scripts/sync-class-statuses.cron.sql`, pure UTC comparison) and reminder timing are correct with **no change** to those jobs.

### D3 — Display in the *viewing user's* school zone (Option A)
Chose a single per-request display zone over per-entity rendering. `getRequestConfig` (`src/lib/i18n.ts`) resolves the viewing user's `school.timeZone` (cached, Lisbon fallback), so every next-intl `useFormatter()` call — server and client — renders in that zone. Server-side notification formatting (`formatClassTime(date, timeZone)`) is passed the **class/exam's** school zone instead, since those run outside the next-intl request scope (routers + reminders cron). Trade-off: a user viewing another school's class across a timezone boundary sees it in their own zone — acceptable for this market (a tenant is effectively one school in one zone).

### D4 — Calendar renders in the school zone
FullCalendar previously rendered in the device's local time (latent inconsistency). Added `@fullcalendar/luxon3` + `luxon`, set `timeZone={schoolTimeZone}` (threaded from `requireDashboardUser().school.timeZone`), and replaced the browser-local slot-prefill formatters with zone-aware ones.

## Tests
- `tests/dates.test.ts` — `wallClockToISO`/`wallClockToUTC` for Lisbon vs Azores, summer + winter.
- `tests/format-class-time.test.ts` — `formatClassTime` per-zone (incl. Azores).
- `tests/school-timezone.test.ts` — end-to-end: a school set to `Atlantic/Azores` stores recurring-class UTC from Azores wall-clock (summer 10:00→10:00Z, winter 10:00→11:00Z).
All run under `TZ=UTC` (the prod runtime).

## Known limitations (revisit later)
- **Changing a school's timezone after classes exist** shifts the displayed wall-clock of already-stored future classes (their UTC instants don't move). Safe to set at creation; warn if changed with future classes.
- **Reminders cron "tomorrow" window** uses UTC day boundaries, not school-local — a class within ~1h of local midnight can land in the adjacent day. Pre-existing (already true under Lisbon-only); not categorically worsened.
- **Dashboard "today"/"week" ranges** (`src/lib/dashboard-ranges.ts`) still compute day boundaries in `Europe/Lisbon`, so for an Azores school a class within ~1h of local midnight can fall in the adjacent day's panel. The *displayed time* is correct (next-intl) — only which panel it lands in is affected. Left for a follow-up; would key the range off the viewing user's school zone.
- **Cross-timezone multi-branch view** — see D3 trade-off.

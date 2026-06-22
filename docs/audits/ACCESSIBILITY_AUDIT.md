# Accessibility Audit

**Date:** 2026-06-18
**Scope:** Entire `src/` UI surface — auth, marketing/legal, dashboard shell, students, classes, calendar, enrollments, instructors, staff, schools, analytics, settings, platform-admin, check-in display, and all shared components + UI primitives.
**Standard:** WCAG 2.1 AA, plus the project's own a11y rules in `CLAUDE.md` ("color must not be the only indicator", semantic HTML, labels on all inputs, keyboard accessibility).

## How to read this

Each finding is `[SEVERITY] file:line — problem → fix`.

- **CRITICAL** — blocks a task entirely for some users (rare here).
- **HIGH** — a real barrier (no keyboard path, unlabeled control, content not announced).
- **MEDIUM** — degraded experience (weak names, missing live regions, color-only cues with text fallback).
- **LOW** — polish (decorative SVGs not hidden, `aria-current` missing).

> **Good news first.** The base primitives are solid: `@base-ui/react` `Dialog` ships a real focus trap + `sr-only` close label; `Button`/`Input`/`Textarea` have proper `focus-visible` rings, `disabled` handling, and `aria-invalid` styling; inputs use `text-base md:text-sm` (no iOS zoom). Most issues below are at the **feature level** or in two primitives that predate the base-ui standard (`radix-select`, `table`).

---

## Tier 0 — Systemic fixes (fix the primitive, fix everywhere)

These are the highest-leverage items: one change resolves dozens of downstream instances.

- **[HIGH] `src/components/ui/table.tsx:68-78`** — `TableHead` renders a bare `<th>` with **no `scope="col"`**. Every table in the app (students, instructors, staff, schools, instructor-workload, bulk-import preview) inherits this — screen readers can't associate headers with cells. → Add `scope="col"` as the default on `TableHead` (allow override via props). *Single fix, resolves all table-semantics findings below.*

- **[HIGH] `src/components/loading.tsx:5`** — The animated-dots spinner has no `role="status"`, `aria-live`, or `sr-only` text. Every async fetch that swaps in `<Loading/>` is silent to screen readers. → Wrap in `role="status" aria-live="polite"` + `<span className="sr-only">{t("common.loading")}</span>`.

- **[MEDIUM] `src/components/ui/skeleton.tsx:8` (and all `src/components/skeletons/*`)** — Skeleton placeholders are purely visual; no `role="status"`/`aria-busy`/sr-only label. → Add `role="status"` + sr-only "loading" text on the top-level skeleton container of each skeleton component (or bake it into the base `Skeleton`).

- **[MEDIUM] `src/components/ui/radix-select.tsx:20`** — `SelectTrigger` uses `focus:ring-1 focus:ring-ring` (mouse-focusable, low-visibility) instead of the design-system `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` used by every other control. Weaker, inconsistent focus indicator on a high-traffic primitive. → Align the focus styles. *(Also tracked as a consistency item — see the UI report.)*

- **[MEDIUM] `src/components/ui/sonner.tsx:7-46`** — All async success/error feedback flows through `sonner` toasts. Sonner ships a live region by default, but it's **unverified** here and many inline pending states ("..." labels) are never announced. → Confirm `<Toaster>` exposes `role="status"`/`aria-live`; treat as the canonical announcement channel and stop relying on color-only inline states.

---

## Tier 1 — High priority (real barriers)

### Charts have no non-visual representation
- **[HIGH] `analytics/_components/enrolments-over-time.tsx:42-78`, `attendance-trend.tsx:43-118`, `pass-rate-by-category.tsx:54-103`** — Recharts SVGs have no `role="img"`/`aria-label`, no `<figure>`/caption, and no table alternative. Screen-reader users get nothing. → Wrap each in a labelled `<figure>` with an `aria-label` data summary, or render a visually-hidden `<table>` of the underlying series.
- **[HIGH] `attendance-trend.tsx:94-116`** — Two series ("classes" vs "attendance %") are distinguished by **color only** (primary vs `#10b981`). → Add distinct dash patterns / markers per series.
- **[HIGH] `pass-rate-by-category.tsx:36-40, 96-100`** — Bar color (green/amber/red) is the **sole** encoding of pass-rate health. → Add a text/icon label for the weak/marginal/healthy classification.

### Calendar is pointer-only and color-only
- **[HIGH] `calendar/_components/class-calendar.tsx:287-343`** — FullCalendar events open only via `eventClick` (pointer); drag-to-create fires on mouse/touch only. **No keyboard path** to view or create a class/exam. → Provide a keyboard-operable affordance (focusable event wrappers with Enter/Space, and/or an agenda/list view exposing events as real controls).
- **[HIGH] `class-calendar.tsx:153-200, 331-342`** — Event status/type/enrollment is conveyed purely by `backgroundColor`/`borderColor` (the only extra cue is a tiny dot for enrolled). → Add a text/icon cue in `eventContent` (status label or icon), not just color.
- **[MEDIUM] `class-calendar.tsx:347-365`** — The student legend swatches use hardcoded colors (`bg-blue-500` etc.) that **don't match** the themed event colors, so the only color key given to color-reliant users is misleading. → Drive the legend from the same color source as the events.

### Unlabeled / weakly-labeled controls
- **[HIGH] `platform-admin/_components/platform-dashboard.tsx:271-280, 303-311`** — Native `<select>` ("Grupo", "Fuso horário") have `<Label>`s with no `htmlFor`/`id` association. → Use the `Select` UI component or wire `id`/`htmlFor`.
- **[HIGH] `platform-dashboard.tsx:247-337`** — Every dialog `<Label>` (tenant/school name, subdomain, morada, telefone, admin name/email/phone/password) lacks `htmlFor`, and the `<Input>`s lack `id`. Labels are only visually adjacent. → Add matching `id`/`htmlFor` pairs.
- **[HIGH] `platform-dashboard.tsx:223-230`** — Icon-only `<a>` (ExternalLink, "open school site") has no accessible name. → Add `aria-label`.
- **[HIGH] `students/_components/bulk-import/upload-step.tsx:73`** — Hidden file `<input type="file" className="sr-only">` has no `id`/`<label htmlFor>`/`aria-label`; keyboard+SR users get no name. → Add `id` + `aria-label`, and `aria-busy={parsing}` + `aria-label` on the dropzone trigger button (`:41`).
- **[HIGH] `(auth)/login/_components/login-form.tsx:124-129`** — The sign-in error block appears asynchronously with no `role="alert"`/`aria-live`; failures are silent to SR. → Add `role="alert"`.

### Search inputs are placeholder-only (no programmatic name)
Placeholders are not accessible names. Add a visually-hidden `<Label htmlFor>` or `aria-label` on each:
- **[MEDIUM] `students/_components/students-page-client.tsx:104`**
- **[MEDIUM] `instructors/_components/instructors-page-client.tsx:98-103`**
- **[MEDIUM] `staff/_components/staff-page-client.tsx:100-105`**
- **[MEDIUM] `settings/_components/gdpr-panel.tsx:59-64`**
- **[MEDIUM] `analytics/_components/analytics-page-client.tsx:44-71` & `audit-log-list.tsx:56-83`** — filter `Select`s also need `aria-label` on each `SelectTrigger`.

---

## Tier 2 — Medium / Low by area

### Auth, marketing & legal
- **[MEDIUM] `login-form.tsx:131-133`** — Loading state renders literal `"..."` as the button label (no accessible "a carregar"). → Translated loading string + `aria-busy`.
- **[MEDIUM] `no-tenant/_components/landing/product-showcase.tsx:284-323`** — Custom lightbox `role="dialog" aria-modal="true"` has Escape-to-close but **no focus trap**, no focus-move-in on open, no focus-restore on close. → Trap + manage focus.
- **[MEDIUM] `product-showcase.tsx:99-114`** — Two `role="tablist"` groups with `role="tab"`/`aria-selected` but no `role="tabpanel"`, no `aria-controls`, no arrow-key roving focus — incomplete ARIA tabs. → Complete the pattern or drop the tab roles.
- **[MEDIUM] `product-showcase.tsx:193-211`** — Single-select screen switcher uses `aria-pressed` (implies independent toggles). → Use `role="radiogroup"`/tablist semantics.
- **[MEDIUM] `(auth)/_components/auth-layout.tsx:37`** — Decorative brand `<h2>` appears in the DOM before the form's `<h1>` (out-of-order heading). → Demote to non-heading or `aria-hidden`.
- **[MEDIUM] `landing/faq-section.tsx:38-45`** — `<h3>` placed *inside* `<summary>` (the button) — invalid; SR heading nav lands on a control. → Move the heading out of `<summary>`.
- **[HIGH-ish] `src/app/error.tsx:13`** — Error boundary renders `<h1>` while nested in the app layout; can produce a second h1 / skipped hierarchy. → Verify against surrounding layout; use `<h2>` if an h1 already exists.
- **[LOW] `install/_components/install-view.tsx:89-106`** — Inline decorative Share/PlusSquare icons not `aria-hidden`. → Hide them.
- **[LOW] `checkin-display/[id]/_components/checkin-display.tsx:80-103`** — QR `<canvas>` has no accessible name; the live "recent check-ins" list has no `aria-live`. (Kiosk display → LOW.) → `aria-label`/`role="img"` on the canvas; `aria-live="polite"` on the list.
- **[LOW] `novidades/_components/blog-nav.tsx:11`** — Logo image uses `alt="Convlyx"` while the adjacent wordmark text already says it (double announcement); other navs correctly use empty alt. → Standardize on empty alt when wordmark text is present.

### Dashboard shell & students
- **[HIGH] `(dashboard)/_components/mobile-top-bar.tsx:88`** — Icon-only logout is a raw `<button>` with no `aria-label`/built-in focus ring. → `<Button variant="ghost" size="icon" aria-label={t("auth.logout")}>`.
- **[MEDIUM] `(dashboard)/_components/header.tsx:62`** — Logout button conveys purpose only via `title` (unreliable for SR/touch). → Add `aria-label`.
- **[MEDIUM] `_components/pending-attendance-modal.tsx:166`** — Present/Absent selection shown only via button `variant` color. → Add `aria-pressed`.
- **[MEDIUM] `bulk-import/upload-step.tsx:86`** — Async parse error `<p>` not in a live region. → `role="alert"`.
- **[MEDIUM] `bulk-import/preview-step.tsx:69`** — Row-status icons (decorative, `AlertCircle` reused for two states) lack `aria-hidden`; text label mitigates. → `aria-hidden` on the icons.
- **[LOW] `bulk-import/preview-step.tsx:48` & `students-page-client.tsx:193`** — Tables lack a `<caption>` (and rely on the `TableHead` scope fix above). → Add `sr-only` `<caption>`.
- **[LOW] `bulk-import/bulk-import-dialog.tsx:106`** — Step indicator has no `aria-current="step"` on the active step. → Add it.

### Classes, calendar & enrollments
- **[MEDIUM] `classes/[id]/_components/class-detail-view.tsx:459-467`** — Mobile "remove" button is a bare `×` glyph with no accessible name (text label is `hidden` on mobile). → `aria-label`.
- **[MEDIUM] `class-detail-view.tsx:441-455, 479-491`** — Attendance buttons hide their text below `sm`, leaving icon-only buttons with no name on mobile. → `aria-label` on each.
- **[MEDIUM] `classes/_components/classes-table.tsx:354, 426`** — Edit icon-only buttons rely on `title` only. → `aria-label`.
- **[LOW] `class-detail-view.tsx:415-422`** — Note-edit icon button uses `title` only. → `aria-label`.
- **[MEDIUM] `classes/_components/create-class-dialog.tsx:484-503`** — Days-of-week checkbox group has no `<fieldset>`/`role="group"` accessible name; the visible `<Label>` isn't tied to the group. → Wrap in `<fieldset><legend>`.
- **[LOW] `create-class-dialog.tsx` (many lines) & `edit-class-dialog.tsx`** — Inline validation `<p className="text-destructive">` not linked via `aria-describedby` and not in a live region; custom controls (Select/DatePicker/TimePicker/StudentPicker) have `<Label>`s with no `htmlFor`/`id`. → Wire `aria-describedby` for errors; give custom controls an `id` + labelled group.
- **[LOW] dialogs across calendar/classes** — `DialogContent` rendered with no `DialogDescription` → no `aria-describedby` context. → Add an `sr-only` `DialogDescription`.
- **[LOW] `classes-table.tsx:299-374`** — Card is an `<a>` (Link) wrapping action `<Button>`s (with `e.preventDefault()`); **nested interactive elements inside a link** = invalid HTML + keyboard/AT hazard. → Restructure so actions are siblings of the link.

### Instructors, staff, schools & analytics
- **[LOW] `instructors/_components/instructors-page-client.tsx:144-155`** — Same nested-interactive-in-`<a>` issue as classes cards. → Restructure.
- **[LOW] `instructor-stats-section.tsx:32,40` (h1→h3 skip)** — Stat labels rendered as `<h3>` with no intervening `<h2>` under the page `<h1>`. → Use `<p>` for stat labels or a proper section heading.
- **[MEDIUM] `platform-dashboard.tsx:166-168`** — Tenant status Badge shows raw English enum (`ACTIVE`/`INACTIVE`) in a PT UI. → Map to translated, sentence-case text.

### Settings & shared components
- **[MEDIUM] `src/components/user-avatar.tsx:11-15`** — Initials `<div>` has no `role="img"`/`aria-label`; announces stray letters. → `aria-label={name}` (or `aria-hidden` when a visible name is adjacent).
- **[MEDIUM] `src/components/empty-state.tsx:6` & `src/components/stat-card.tsx:8`** — Decorative Lucide icons lack `aria-hidden`. → Add it.
- **[MEDIUM] `settings/_components/install-qr.tsx:49`** — QR `<canvas>` unlabeled. → `aria-label`/`role="img"`.
- **[MEDIUM] `src/components/confirm-dialog.tsx:36`** — Message is a plain `<p>`, not a `DialogDescription` (so not wired as `aria-describedby`). → Render via `DialogDescription`.
- **[MEDIUM] `src/components/date-picker.tsx:112-134`** — `TimePicker` is a grid of raw `<button>`s with no `role="listbox"`/`option`, no roving tabindex, no arrow-key nav (Tab through ~60 buttons). → Make it a listbox/radiogroup with arrow-key roving focus.
- **[MEDIUM] `settings/_components/gdpr-panel.tsx:67-69`** — Results region swaps in `<Loading/>` with no `aria-live`/`aria-busy`. → Wrap in `aria-live="polite"`.
- **[LOW] `src/components/pagination.tsx:48-78`** — Prev/next icon buttons have no `aria-label`; active page lacks `aria-current="page"`. → Add both.
- **[LOW] `src/components/view-toggle.tsx:57-74`** — Icon-only toggles use `title` only; no `aria-pressed`/group label. → `aria-label` + `aria-pressed`, wrap in labelled `role="group"`.
- **[LOW] `src/components/category-multi-select.tsx:23`** — Checkbox set has no group label. → `role="group"`/`fieldset` + `aria-label`.
- **[LOW] `src/components/ui/calendar.tsx:147-163`** — Chevron nav SVGs may double-announce; confirm `aria-hidden`.

---

## Prioritized action checklist

**Do first (Tier 0 — primitive-level, fixes propagate):**
1. [ ] `TableHead` → default `scope="col"` (`ui/table.tsx`)
2. [ ] `Loading` → `role="status"` + sr-only label (`components/loading.tsx`)
3. [ ] Skeletons → `role="status"` + sr-only label
4. [ ] `radix-select` → upgrade focus ring to `focus-visible:ring-3`
5. [ ] Verify `Toaster` live region (`ui/sonner.tsx`)

**Then (Tier 1 — barriers):**
6. [ ] Charts: `<figure>`/`aria-label` + table alternative + non-color series encoding
7. [ ] Calendar: keyboard path to open/create events + non-color status cue + legend↔event color parity
8. [ ] platform-admin: associate every `<Label>`/control; replace native `<select>` with `Select`; name the ExternalLink
9. [ ] bulk-import: label the file input + dropzone; announce parse errors
10. [ ] login: `role="alert"` on the auth error
11. [ ] All search inputs + filter selects: add `aria-label`/sr-only `<Label>`

**Then (Tier 2 — polish):** icon-only buttons relying on `title` → `aria-label`; decorative icons → `aria-hidden`; nested buttons-in-links → restructure; `DialogDescription` on dialogs; `aria-current` on steps/pagination; mobile icon-only attendance/remove buttons → `aria-label`.

---

*Generated by an automated multi-agent audit. Line numbers reflect the working tree at 2026-06-18 and may shift as files change — re-grep the described pattern if a line doesn't match.*

# UI Consistency Audit

**Date:** 2026-06-18
**Scope:** Entire `src/` UI — every page, feature component, shared component, and UI primitive.
**Goal:** Measure deviations from the design-system baseline (control sizing, spacing, color tokens, typography) and identify duplicated markup that should be extracted into shared components.

## Design-system baseline (the source of truth)

Primitives live in `src/components/ui/` and are built on **`@base-ui/react`**:

| Primitive | Spec |
|---|---|
| `Button` | heights: `default=h-9`, `sm=h-7`, `xs=h-6`, `lg=h-11`; icons: `icon=size-8`, `icon-sm=size-7`, `icon-xs=size-6`, `icon-lg=size-9`. Built-in `cursor-pointer`, `focus-visible` ring, `disabled`. Variants: default/outline/secondary/ghost/destructive/link. |
| `Input` | `h-8`, `rounded-lg`, `px-2.5 py-1`, `text-base md:text-sm`, `focus-visible:ring-3`. |
| `Textarea` | `rounded-lg`, `px-2.5 py-1.5`. |
| `Label` | `text-sm font-medium`. |
| `Dialog` | `DialogContent` = `sm:max-w-sm`, `p-4 gap-4`, sr-only close. |
| `Badge` | `h-5`, `px-2`, `text-xs`, `rounded-4xl`. |

Theme tokens (never hardcode): `text-foreground`, `text-muted-foreground`, `bg-background`, `bg-card`, `bg-muted`, `border-input`, `border-border`, `text-destructive`, `bg-primary`, `bg-secondary`.

---

## Tier 0 — Design-system foundation (fix these first; everything else inherits them)

### F1 — Two parallel Select implementations (the single biggest divergence)
- **[HIGH]** `src/components/ui/radix-select.tsx:4` is built on **`@radix-ui/react-select`**, while every other primitive (Button, Input, Dialog, Popover, Tabs, Tooltip) is **`@base-ui/react`**. It's imported across the app: `students-page-client`, `create-user-dialog`, `edit-user-dialog`, `schedule-exam-dialog`, `record-exam-result-dialog`, `mapping-step`, `settings-form`, classes/calendar filters, analytics, audit, platform-admin.
  → **Decide and document:** either migrate Select to a base-ui implementation (`ui/select.tsx`) or formally sanction Radix as the canonical select. Until decided, every consumer carries the inconsistency.

### F2 — `SelectTrigger` doesn't match `Input`
- **[HIGH]** `radix-select.tsx:20` — `SelectTrigger` is `h-9 rounded-md px-3 shadow-sm focus:ring-1`, but `Input` is `h-8 rounded-lg px-2.5` (no shadow) with `focus-visible:ring-3`. In any form mixing the two (e.g. `settings-form.tsx:157` select vs `:178` input) they're visibly mismatched in **height, radius, elevation, and focus style**.
  → Align `SelectTrigger` to `h-8 rounded-lg px-2.5`, drop `shadow-sm`, and use `focus-visible:ring-3`.

### F3 — No semantic status color tokens → hardcoded palette colors everywhere
- **[HIGH]** There are no `--success` / `--warning` / `--info` tokens (only `--primary`, `--destructive`, etc. exist). As a result, success/warning/info states are hardcoded with raw Tailwind palette literals across the app:
  - `lib/constants/class.ts:42-70` — `classTypeColorMap`/`classTypeBadgeClass`/`roleColorMap` use `blue-*`/`emerald-*`/`purple-*`.
  - Charts: `attendance-trend.tsx:111` (`#10b981`), `pass-rate-by-category.tsx:37-38` (`#f59e0b`) mixed with `var(--primary)`/`var(--destructive)`.
  - `snapshot-row.tsx:31-37`, `staff-page-client.tsx:145`, `instructor-stats-section.tsx`, `student-home.tsx`, `instructor-home.tsx`, `checkin-display.tsx:99` — `emerald-*` for "success/delta".
  - bulk-import: `preview-step.tsx:71-93`, `results-step.tsx:16-18` — `amber/blue/emerald-600`.
  → Introduce `--success` / `--warning` / `--info` CSS variables, expose tokenized chart/class color maps, and replace raw `emerald/amber/blue` usages.

### F4 — Missing primitives that force per-instance reinvention
- **[MEDIUM] No `Checkbox` primitive** (`ui/checkbox.tsx` does not exist). Raw `<input type="checkbox" className="accent-primary">` is reinvented in `create-class-dialog.tsx:488` and `category-multi-select.tsx:33`. → Add a shared `Checkbox`.
- **[MEDIUM] No `Card`/`SectionCard` primitive.** The "section card" cluster `rounded-xl border bg-card p-5 card-shadow` (+ `hover:card-shadow-hover`) is duplicated in `settings-form.tsx` (137/228/271/284), `install-qr.tsx:41`, `push-prompt.tsx:77`, `stat-card.tsx:5`, install-view, and every skeleton. → Extract a `Card`/`SectionCard`.

### F5 — Container radius / spacing have no single scale
- **[MEDIUM]** Card radius drifts between `rounded-xl`, `rounded-2xl`, and `rounded-3xl` for equivalent surfaces:
  - lists/tables use `rounded-xl` (classes-table, instructors, staff, schools); cards use `rounded-2xl` (enrollments-list, student-home, instructor-home); public pages mix `xl/2xl/3xl` (install-view vs checkin-display vs legal).
  → Settle on one card-radius token.
- **[MEDIUM]** Page vertical rhythm differs per page: `space-y-4` (instructors/staff/students), `space-y-6` (schools/dashboard-view/student-detail), `space-y-8` (platform-dashboard). Layout content padding also diverges (`p-4 md:p-6` vs `px-4 pt-4 pb-28`). → Standardize page-root `space-y` and centralize content padding in the layout.

---

## Tier 1 — Components to extract (de-duplication)

Each row is markup repeated across ≥2 files that should become one shared component.

| Proposed component | What it unifies | Repeated in |
|---|---|---|
| **`PageHeader`** (title + description + actions + optional back-link) | List/detail/dashboard page headers, currently hand-rolled with divergent classes & heading sizes | `students-page-client.tsx:100`, `instructors/staff/schools-page-client`, `dashboard-view.tsx:70`, `classes-page-client.tsx:15`, `calendar-view.tsx:38`, `student-header-section.tsx:99`, `mobile-top-bar.tsx:77`, `platform-dashboard.tsx:128`, `audit/page.tsx:50` |
| **`ChartCard`** (title + subtitle/range + body) | `section.rounded-xl border bg-card p-5 card-shadow space-y-4` + `h2 text-lg font-semibold` + range `<p>` | `enrolments-over-time.tsx:31`, `attendance-trend.tsx:32`, `pass-rate-by-category.tsx:43`, `instructor-workload.tsx:28` |
| **`DataTableCard`** | `rounded-xl border card-shadow overflow-hidden` + `<Table>` + `hover:bg-muted/50` rows | `instructors-page-client.tsx:183`, `staff-page-client.tsx:187`, `schools-table.tsx:64`, `instructor-workload.tsx:39` |
| **`EntityCard` / `ListItemCard`** | `rounded-2xl border bg-card p-4 card-shadow hover:card-shadow-hover` list card (mobile view) | `instructors-page-client.tsx:125`, `staff-page-client.tsx:131`, `schools-table.tsx:29`, `students-page-client.tsx:138`, `dashboard-view.tsx:158`, `student-home.tsx:242/296`, `instructor-home.tsx:280` |
| **`ClassCard` / `SessionCard`** | Class card shell (icon tile + title/badges/meta row) | `classes-table.tsx:302`, `enrollments-list.tsx:119` |
| **Detail-page set** (`DetailHeaderCard`, `HistoryListSection`, `DangerZoneSection`, `DetailPageBackLink`) | Instructor and student detail sections are **near-identical** | `instructors/[id]/_components/*` ↔ `students/[id]/_components/*` (header / stats / history / danger-zone / detail-page) |
| **`ClassFormFields`** | Title/capacity/category/instructor/date/time field blocks duplicated between create & edit | `create-class-dialog.tsx:387-420` ↔ `edit-class-dialog.tsx:181-266` |
| **`ClassFilters`** | Type + instructor select filter bar, duplicated with divergent sizing | `classes-table.tsx:215` (h-10) ↔ `calendar-filters.tsx:25` (h-9) |
| **`DialogForm`** | `<form className="flex flex-col flex-1 min-h-0">` + `DialogBody` + Cancel/Save footer | `create-user-dialog.tsx:109`, `edit-user-dialog.tsx:109`, start/schedule/record dialogs |
| **`SegmentedTabs` / `TimeTabs`** | "upcoming/past" segmented control | `classes-table.tsx:183`, `enrollments-list.tsx:95` |
| **`NavLink`** | Nav-link class string + active-state logic (sidebar `py-2` vs mobile-nav `py-2.5`) | `sidebar.tsx:82/106`, `mobile-nav.tsx:77/101` |
| **`IconTile`** | Square icon "avatar" tile, reimplemented 3 ways (`bg-primary/10` vs hardcoded `bg-emerald-100`) | `instructor-header-section.tsx:71`, `platform-dashboard.tsx:195`, `schools-table.tsx:33` |
| **`StatCard` adoption** | `StatCard` exists but is bypassed by inline cards | `instructor-stats-section.tsx:29`, `student-stats-section.tsx:29`, `student-home.tsx:180`, `instructor-home.tsx:147`, `platform-dashboard.tsx:369` (local `StatCard` duplicate), `snapshot-row.tsx:91` |
| **`LandingNav` + `LandingCta`** | Floating pill nav + green CTA duplicated, one path uses `Button`, the other hand-rolled `<button>` | `landing/landing-nav.tsx` ↔ `seo-landing.tsx:82`; `landing-hero`/`final-cta`/`security-section` CTAs |
| **Public-page `Nav` + legal `Section`** | Fixed top nav duplicated; `Section` helper copy-pasted in all 3 legal pages | `(legal)/_components/legal-page.tsx` ↔ `novidades/_components/blog-nav.tsx`; `politica-de-cookies/page.tsx:152`, `politica-de-privacidade/page.tsx:217`, `termos-e-condicoes/page.tsx:201` |

---

## Tier 2 — Hardcoded overrides & raw elements

### Control sizing overrides (drop these; rely on variants)
- **[HIGH] `platform-dashboard.tsx:271-311`** — Raw `<select className="flex h-9 ...">` instead of `Select` (also a11y). → Replace with `Select`.
- **[HIGH] `classes-table.tsx:211`** — Search `Input` forced to `h-10` (baseline `h-8`).
- **[HIGH] `classes-table.tsx:217/227/239/252`** — `SelectTrigger` forced to `h-10` while `calendar-filters.tsx:28/38` uses default `h-9` → the two filter bars render different heights.
- **[MEDIUM] `students-page-client.tsx:109`** — Search `Input` forced to `h-9` while the adjacent `SelectTrigger` uses default → mismatched.
- **[MEDIUM] `instructors-page-client.tsx:102`** sets search `h-9`; `staff-page-client.tsx:104` omits it (baseline `h-8`) → same pattern, two heights.
- **[MEDIUM] filter `SelectTrigger` widths** differ: `w-[130px]` (instructors:106) vs `w-auto min-w-[140px]` (staff:108, analytics:48). → Standardize.
- **[MEDIUM] `date-picker.tsx:36/96`** — Triggers hardcode `h-9` (redundant; it's the Button default). → Remove.
- **[MEDIUM] `pagination.tsx:64`** — `size="sm"` + `h-7 w-7 p-0` manual override. → Use `size="icon-sm"`.
- **[MEDIUM] `view-toggle.tsx:62/69`** — `size="icon-sm"` **and** redundant `h-7 w-7`. → Remove the override.

### Raw elements instead of components
- **[HIGH] `src/app/error.tsx:17-22`** — Raw `<button>` with hand-rolled `bg-primary px-4 py-2 ...`. → `<Button onClick={reset}>`.
- **[HIGH] `src/app/not-found.tsx:9-14`** — Raw `<Link>` styled as a button. → `buttonVariants()` (as `install-view.tsx:58` already does).
- **[HIGH] `platform-dashboard.tsx:31`** — Badge built from raw spans (`bg-destructive/10 ... rounded-full`). → `<Badge variant="destructive">`.
- **[LOW] `admin-logout.tsx:13-19`** — Raw `<button>`. → `<Button>`.
- **[MEDIUM] `class-detail-view.tsx:415-422`** — Raw `<button>` for note-edit. → `<Button variant="ghost" size="icon-xs">`.
- **[MEDIUM] `create-class-dialog.tsx:488` & `category-multi-select.tsx:33`** — Raw checkbox `<input>`. → shared `Checkbox` (F4).
- **[MEDIUM] `category-badge.tsx:9`** — Re-implements a badge as a raw `<span>` (`rounded-md ... text-[10px]`), divergent radius/size/typography from `Badge`. → Use `<Badge variant="outline">` or document why category badges differ.
- **[MEDIUM] `date-picker.tsx:118-130`** — Time slots are raw `<button>`s with bespoke styling. → `Button` variants, or document the dense-grid exception.
- **[MEDIUM] `audit-log-list.tsx:89-113`** — Audit log rendered as `<div>` rows with `divide-y` instead of a `<Table>` (semantics + consistency). → Use `<Table>`.

### Inconsistent status / badge rendering
- **[MEDIUM] `class-detail-dialog.tsx:127`** — Computes class-status variant inline (`CANCELLED ? destructive : outline`) instead of the shared `statusVariant` map used by `classes-table.tsx:313/410` & `class-detail-view.tsx:198`. → Use `statusVariant` everywhere.
- **[MEDIUM] exam status** — `exam-detail-dialog.tsx:20-34` (`RESULT_VARIANT`) vs `class-calendar.tsx:45-66` (`examColors`) define the same exam-result styling twice. → Centralize in `lib/constants`.
- **[MEDIUM] bulk-import** — `preview-step.tsx:71-93` / `results-step.tsx` render statuses as ad-hoc colored `<span>`s + icons instead of `<Badge>`. → Use `<Badge>` variants.

### Typography off-scale
- **[MEDIUM]** Heading scale is inconsistent: `h1` is `text-2xl font-bold` on most pages but `text-xl sm:text-2xl` on detail headers; `h2` alternates `text-lg font-semibold` and `text-base font-semibold`. None use `font-heading` (only `DialogTitle` does, per baseline). → Define a heading scale and apply `font-heading` consistently.
- **[LOW] `text-[10px]` recurs** (`student-home`, `instructor-home`, `mobile-tab-bar.tsx:67`, `bulk-import-dialog.tsx:115`, `category-badge.tsx:9`) — off the type scale; same caption role uses `text-xs` elsewhere. → Consolidate to `text-xs` or a token.
- **[LOW] `(auth)/login/page.tsx:15`** — Arbitrary `text-[1.7rem]`/`text-[0.95rem]` where other auth pages use scale classes. → Use the standard scale.

### Hardcoded colors (beyond F3's status colors)
- **[MEDIUM] landing components** — `seo-landing.tsx:83`/`landing-nav.tsx:16` use raw `bg-white`/`text-white`/hex (`#166534`, `#1f2937`, `#374151`) **inside** `.landing-scope`, bypassing the `--landing-*` tokens that already define those colors. → Use the `--landing-*` variables.
- **[LOW] `checkin-display.tsx:99`** — `text-emerald-500` for a present/success state. → success token (F3).
- **[LOW] `install-qr.tsx:48`** — `bg-white` + `#000000`/`#ffffff` QR colors (intentional for scannability) — keep but comment.

### Loading / empty / error treatment
- **[MEDIUM]** Two loading idioms coexist (`Loading` animated-dots vs `Skeleton` shells). `gdpr-panel.tsx:68` uses `<Loading/>` on a settings page that otherwise uses skeletons; analytics charts use one-off `<Skeleton h-64>`/`h-40` instead of a shared chart skeleton; `class-detail-dialog.tsx:84` returns `null` while loading (no state). → Document when to use spinner vs skeleton; give every async surface a consistent loading + error state.
- **[LOW]** Skeleton geometry drifts from the real components (`list-page-skeleton.tsx:19` uses `h-9` for inputs that are `h-8`; `stat-card` value is `text-3xl` but its skeleton models `h-8`). → Match skeleton dimensions to components.

### i18n leakage (related — flagged during the sweep)
- **[HIGH] `platform-dashboard.tsx` (whole file)** and **[MEDIUM] `seo-landing.tsx`** contain hardcoded Portuguese strings, violating the no-hardcoded-strings rule. platform-admin has a comment claiming operator-only intent — **confirm** whether that exemption stands; the SEO landing has no such exemption and its main-landing twin uses `t(...)`.
- **[LOW] `ui/dialog.tsx:127`** — `DialogFooter`'s built-in close button hardcodes the literal `"Close"`. → `t("close")`.

---

## Prioritized action checklist

**Do first (Tier 0 — foundation):**
1. [ ] Decide Select strategy: migrate `radix-select` → base-ui, or sanction it (F1)
2. [ ] Align `SelectTrigger` to Input sizing/radius/focus (F2)
3. [ ] Add `--success`/`--warning`/`--info` tokens; tokenize class/chart color maps; purge raw `emerald/amber/blue` (F3)
4. [ ] Add `Checkbox` and `Card`/`SectionCard` primitives (F4)
5. [ ] Standardize card radius + page `space-y` scale (F5)

**Then (Tier 1 — extraction, biggest LOC + drift reduction):**
6. [ ] `PageHeader`, `ChartCard`, `DataTableCard`, `EntityCard`, `ClassCard`
7. [ ] Unify instructor/student detail sections (`DetailHeaderCard`, `HistoryListSection`, `DangerZoneSection`)
8. [ ] `ClassFormFields`, `ClassFilters`, `DialogForm`, `SegmentedTabs`, `NavLink`, `IconTile`
9. [ ] Adopt existing `StatCard` everywhere (remove inline duplicates incl. platform-admin's local copy)
10. [ ] Unify landing/public nav + CTA + legal `Section`

**Then (Tier 2 — cleanup):** remove `h-10`/`h-9`/`h-7 w-7` overrides; swap raw `<button>`/`<select>`/`<input>`/`<span>` badges for components; route all statuses through shared `statusVariant`/`Badge`; fix heading scale + `font-heading`; resolve i18n leakage.

---

*Generated by an automated multi-agent audit. Line numbers reflect the working tree at 2026-06-18 and may shift — re-grep the described pattern if a line doesn't match. Marketing/`landing-scope` styles intentionally use a separate `--landing-*` token system; deviations there are flagged only where they bypass even those tokens.*

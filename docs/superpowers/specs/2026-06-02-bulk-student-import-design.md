# Bulk Student Import — Design

**Date:** 2026-06-02
**Status:** Implemented
**Author:** Francisco + Claude

## Problem

Onboarding a new school means entering their existing roster — often 40+ students —
one at a time through the "Add student" dialog. That is a wall: it's the kind of
friction that makes a school abandon the tool before seeing value. Schools already
keep their students in a spreadsheet (Excel/CSV) with names, emails, and phones.

We want to let an admin/secretary upload that spreadsheet and import the whole roster
in one pass, while coping with the fact that **every school organizes their sheet
differently** (column order, headers, language, category present or not).

## Goals

- Import a roster from an `.xlsx` / `.xls` / `.csv` file of any column layout.
- Map the school's columns to our fields without forcing a rigid template.
- Let the importer **see and fix problems inline** before anything is created.
- Reuse the existing, battle-tested single-student creation path (invite + DB).
- Desktop-first UI that doesn't break on mobile, fully keyboard-accessible.

## Non-Goals (YAGNI)

- **No "import as records without invite" mode.** Decision: every imported student
  gets a Supabase invite email, mirroring single-create. The app ships with every
  client today, so "adding students" means "putting them on the app."
- No per-plan gating (plans don't exist yet).
- No background/queued import job. A roster is tens of rows, not thousands —
  a synchronous request with a progress indicator is enough.
- No re-import / sync / update-existing flow. Import creates (or reactivates, via the
  existing path); editing existing students stays in the current UI.
- No drag-and-drop column mapping (rejected for accessibility + build cost; dropdowns
  give the same flexibility).

## Decisions (from brainstorming)

1. **Invites:** invite everyone on import (reuse single-create behavior).
2. **Bad rows:** fix inline in a preview table, then import — not all-or-nothing,
   not silent-skip.
3. **Mapping UI:** one dropdown per *our* field, listing the spreadsheet's headers,
   pre-filled by auto-detection. No drag-and-drop.
4. **Category:** batch default + per-row override, implemented as "default-fill +
   mappable column + editable cell" — no special-case mechanism.

## Flow

A four-step wizard inside a dialog/modal on the Students page:

```
Upload  →  Map columns  →  Preview & fix  →  Results
```

### Step 1 — Upload

- Drop zone + file picker (single file). Accept `.xlsx`, `.xls`, `.csv`.
- Parsing happens **in the browser**, not via a server upload. We read the workbook
  with SheetJS (`xlsx`), take the first sheet, and produce `{ headers: string[],
  rows: Record<string, string>[] }`.
- The `xlsx` library is **lazy-loaded** behind this interaction (dynamic `import()`),
  matching the perf convention for heavy click-only libs (jspdf, posthog-js). It must
  not land in any route bundle.
- If the file has no rows or no detectable header row, show a friendly error and stay
  on this step.

### Step 2 — Map columns

- For each of **our** fields, a shadcn `Select` whose options are the spreadsheet's
  column headers (plus "— none —"):
  - **Name** (required mapping)
  - **Email** (required mapping)
  - **Phone** (optional)
  - **Category** (optional — falls back to the batch default)
- **Auto-detect** pre-fills each dropdown by matching headers case-insensitively
  against a synonym list (PT-PT first):
  - Name ← `nome`, `name`, `aluno`, `nome completo`
  - Email ← `email`, `e-mail`, `correio`
  - Phone ← `telefone`, `telemóvel`, `telemovel`, `contacto`, `phone`, `nº`
  - Category ← `categoria`, `category`, `carta`
  - The synonym lists live in one small constant so they're easy to extend.
- **Batch "Default category"** dropdown (our `LICENSE_CATEGORIES`), shown here.
  Applied to every row that has no recognized per-row category in Step 3.
- **School selector:** if the tenant has one school, auto-selected and hidden (mirrors
  `create-user-dialog`). If multiple, a required `Select` — the whole import goes to
  one school.
- "Continue" is disabled until Name + Email are mapped and a school + default category
  are chosen.

### Step 3 — Preview & fix

- Build a working table of rows from the mapping. Columns: **Name, Email, Phone,
  Category**, plus a status indicator and a remove-row action.
- **Category fill order per row:** mapped category column value (if it maps to a valid
  `LICENSE_CATEGORIES` member) → otherwise the batch default. The resulting value lands
  in an **editable cell** like every other field.
- **Live per-row validation** (no server call needed for most of it):
  - Name non-empty.
  - Email valid (`z.email`) and **unique within the file** (flag in-file duplicates).
  - Category is a valid `LICENSE_CATEGORIES` member.
  - Phone optional, no format constraint (kept lenient — schools store many formats).
- **Existing-student check:** one tRPC query (`user.checkExistingEmails`) takes the
  file's emails and returns which already exist in the tenant and their status:
  - `ACTIVE` → flag the row as "already a student" (will be **skipped**, not edited).
  - `INACTIVE` → allowed; import will **reactivate** via the existing create path.
    Show an unobtrusive "will be reactivated" note.
  - This runs once when entering Step 3 and after edits to changed emails (debounced).
- Every cell is editable inline; fixing a cell re-validates that row live.
- A row can be removed entirely (e.g. a student they don't want to import).
- **"Import N students"** is enabled only when every *non-removed, non-skipped* row is
  valid. Rows flagged as ACTIVE-existing are shown but excluded from the count.

### Step 4 — Results

- Submit the clean rows to `user.bulkCreate`. Show a progress state while it runs.
- Render a per-row result list: ✓ created / ↻ reactivated / ✗ failed + reason
  (translated). Failures do **not** roll back successes.
- Offer "Import another file" and "Done" (which refetches the students list).

## API

### `user.bulkCreate` (new tRPC mutation)

- `roleProtectedProcedure(["ADMIN", "SECRETARY"])` — same guard as `create`.
- **Input** (new `bulkCreateUsersSchema` in `src/lib/validations/user.ts`):
  ```ts
  {
    schoolId: z.string().uuid(),
    students: z.array(z.object({
      name: z.string().min(1),
      email: z.email(),
      phone: z.string().optional(),
      category: z.enum(LICENSE_CATEGORIES),   // already resolved client-side
    })).min(1).max(200),                        // generous cap; guards abuse
  }
  ```
  Role is implicitly STUDENT (this is a student-import feature), so it's not in the
  per-row shape — set server-side.
- **Behavior:** validate the school belongs to the tenant once, then iterate rows
  **sequentially** (not `Promise.all`) to avoid hammering Supabase Auth's invite
  endpoint / rate limits. For each row, run the shared create-or-reactivate helper.
- **Output:** `Array<{ email; status: "created" | "reactivated" | "skipped" | "failed";
  reason?: string }>` — one entry per input row, in order. A single bad row never aborts
  the batch. (`skipped` is the defensive case for an email that became ACTIVE between
  preview and import — the preview already excludes known-ACTIVE rows from submission,
  so it's a race guard, not a normal path.)

### Refactor: extract a shared `createStudentAccount` helper

The invite + transaction + collision/reactivation logic in `user.create`
(`src/server/routers/user.ts:255–397`) is exactly what each bulk row needs. Extract it
into one internal helper (e.g. `src/server/lib/create-user.ts`) that takes
`(db, tenantId, school, input)` and returns the created/reactivated user — then have
**both** `user.create` and `user.bulkCreate` call it. This avoids duplicating the
auth/DB/collision handling and keeps behavior identical. No behavior change to
`user.create`; it just delegates.

### `user.checkExistingEmails` (new tRPC query)

- `roleProtectedProcedure(["ADMIN", "SECRETARY"])`.
- Input: `{ emails: z.array(z.email()).max(200) }`.
- Output: `Array<{ email; status: "ACTIVE" | "INACTIVE" }>` for emails that exist in the
  tenant (absent = new). Tenant-scoped via the Prisma extension. Powers the preview's
  existing-student flagging without leaking other tenants' data.

## Components (co-located under the Students page)

`src/app/(dashboard)/students/_components/bulk-import/`
- `bulk-import-dialog.tsx` — wizard shell + step state (client component).
- `upload-step.tsx` — drop zone + file picker; calls the parser.
- `mapping-step.tsx` — field dropdowns, auto-detect, school + default-category pickers.
- `preview-step.tsx` — editable validation table.
- `results-step.tsx` — per-row outcome list.
- `parse-spreadsheet.ts` — dynamic-`import()` SheetJS wrapper → `{ headers, rows }`.
- `column-detect.ts` — header synonym lists + auto-detect logic.
- `use-bulk-import.ts` — hook holding wizard state (file data, mapping, working rows,
  validation) so each step component stays a focused leaf.

Entry point: an "Importar alunos" button next to "Adicionar aluno" in
`students-page-client.tsx`.

## i18n

All strings via `next-intl` under a new `students.import.*` namespace in
`messages/pt-PT.json` — step titles, field labels, validation messages, result
statuses. PT-PT throughout ("Importar alunos", "categoria", "telemóvel"). Zero
hardcoded text.

## Error Handling

- Parse failures (corrupt file, no rows, no headers): inline error on the upload step,
  no toast spam.
- Validation: surfaced per-cell/per-row in the preview, never via exceptions.
- Per-row import failures: collected and shown in Step 4; never abort the batch.
- The mutation returns translatable message keys for failures (reusing existing
  `users.*` keys like `emailAlreadyRegistered`, `inviteFailed`) — never raw Supabase
  errors to the client (matches the "never expose internals" rule).

## Testing

- **`column-detect`**: unit tests — PT/EN headers, mixed case, missing columns,
  ambiguous headers.
- **`parse-spreadsheet`**: unit tests with small `.xlsx` and `.csv` fixtures →
  expected `{ headers, rows }`; empty-file and header-only edge cases.
- **Preview validation logic** (pure functions extracted from the hook): invalid email,
  in-file duplicate, invalid/blank category → default fill, row removal effects on the
  enabled-count.
- **`user.bulkCreate`**: integration-style test — mix of new / existing-ACTIVE /
  existing-INACTIVE / invalid rows → correct per-row statuses, successes persist when a
  later row fails, tenant scoping holds.
- **`createStudentAccount` helper**: covered transitively, but assert `user.create`
  behavior is unchanged after extraction (regression guard).

## Dependencies

- **`xlsx` (SheetJS) — registry package, `^0.18.5`.** Initially installed as the
  patched CDN tarball (`https://cdn.sheetjs.com/...0.20.3.tgz`), but that proved
  fragile: a CDN-tarball dependency re-fetches on every install and silently drops if
  the CDN is unreachable, which broke parsing locally and risked breaking Vercel builds.
  Switched to the registry package for deterministic installs. The known 0.18.5
  advisories (prototype-pollution, ReDoS) are not a realistic risk here: parsing happens
  client-side, in an authenticated admin/secretary's own browser, on a file they
  uploaded themselves — there is no untrusted-input path and no server-side parse. If
  SheetJS ships a registry release that fixes these, bump to it.
- The dynamic `import("xlsx")` resolves the module defensively (namespace vs `.default`)
  so bundler interop differences can't reproduce a "passes in the test runner, fails in
  the browser bundle" gap.

## Open Questions / Risks

- **Supabase invite rate limits:** sequential invites mitigate bursts, but a 200-row
  import is still 200 emails. The 200 cap + sequential processing is the guard for now;
  if real schools hit limits we revisit (queue/throttle) post-evidence, not pre-emptively.
- **Request duration:** sequential external calls for ~40 rows is well within the
  Vercel function timeout; a 200-row worst case should still be comfortable but is the
  thing to watch first if timeouts appear.

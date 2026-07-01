# Pre-launch hardening + cross-tenant identity — design spec

**Date:** 2026-06-24
**Status:** Draft — design only, not yet scheduled for implementation
**Author:** Francisco (with Claude)

## Context

The product is feature-complete, has no reported bugs, and passed recent a11y/UI,
security, and TODO audits. One school trialled it and their feedback shipped; they
are not yet using it in production. With no real sustained multi-tenant usage, the
remaining risk is **operational and structural**, not feature gaps.

This doc captures four pieces of work to do before (and around) the first live
school. Three are scoped operational/compliance items; the fourth — letting **one
person (one email) belong to several tenants at once** — is a genuine architectural
change and gets the full design treatment here.

Nothing in this doc is built yet. It exists so we can implement deliberately later.

---

## Priority summary

| # | Workstream | Why it matters | Size |
|---|-----------|----------------|------|
| A | Prod migration-routing fix | Can't safely ship schema changes once a school is live | Investigate + external (Supabase) |
| B | Backups & disaster recovery | Zero DR posture in repo; untested restore for EU customer data | Small (mostly verify + document + test) |
| C | Consent records + DPA | Real EU compliance gap is the DPA + recorded acceptance (not a banner) | Small–medium |
| D | Cross-tenant identity | Same email in multiple schools — touches core auth/data model | **Large — design below** |

Recommended sequencing is in [§6](#6-sequencing).

---

## A. Prod migration-routing fix

**Problem.** `prisma migrate deploy` is intentionally absent from the `build` script
(`package.json`). Per `CLAUDE.md` "KNOWN ISSUE", connecting to prod via the pooler URL
(`postgres.idvupzweddgjcolgrluz`) lands on a *different physical Postgres* than the
Supabase dashboard SQL Editor shows for the same project. Confirmed empirically (a
marker table written via Prisma was invisible in the dashboard). As a result:

- Migrations are applied to prod by **hand-pasting `.sql`** into the dashboard SQL
  Editor and manually `INSERT`-ing a row into `_prisma_migrations`.
- `db:migrate:status:prod` and `db:migrate:deploy:prod` are **not trustworthy** (they
  route through the broken URL).
- At least one migration — `20260604193700_add_school_time_zone` — is applied to dev
  and **awaits manual prod apply**.

**Why it's #1.** While we are the only ones touching the system this is merely
annoying. The moment a paying school is live, every schema change is a manual,
error-prone, unverifiable ritual — exactly the wrong thing to be doing under load.

**Work to do.**
1. Open a Supabase support ticket describing the pooler-vs-dashboard physical-DB
   split (no branching enabled; password reset didn't change it).
2. In parallel, empirically confirm which physical DB prod's `DATABASE_URL` (the one
   Vercel actually uses at runtime) hits — write a marker row via the live app, then
   read it back via each connection path. Document the finding.
3. Reconcile `_prisma_migrations` between what the live app sees and the dashboard.
4. **Goal state:** a single reviewed, automated migration step again (re-add
   `prisma migrate deploy` to deploy, or a dedicated deploy job) — only once routing
   is provably consistent. Until then, keep the documented manual workflow.

**Out of scope:** changing the dev migration workflow (it works).

**Open decision A1:** if Supabase can't resolve the routing split quickly, do we
migrate the prod project to a fresh Supabase project with clean routing (one-time
data migration), or live with the manual workflow indefinitely? Defer until the
ticket comes back.

---

## B. Backups & disaster recovery

**Problem.** The repo has **no** backup automation, PITR config, restore scripts, or
DR documentation. The only scheduled jobs are `/api/cron/reminders` (daily
notifications) and the `pg_cron` class-status sync (`scripts/sync-class-statuses.cron.sql`)
— neither is a backup. Our entire DR posture is "whatever Supabase plan we're on,"
and the repo doesn't even record what tier that is or whether PITR is enabled.

**Why it matters.** Multi-tenant Postgres holding EU student records (GDPR scope). We
must be able to answer, with a *tested* procedure rather than an assumption:

- Can we do point-in-time recovery, and to what granularity / retention?
- Can we restore **one tenant** without clobbering the others?

**Work to do.**
1. Confirm and **document the Supabase plan tier** and its backup/PITR guarantees
   (retention window, granularity). Record in `docs/decisions/`.
2. If PITR isn't available on the current tier and we hold real customer data, decide
   whether to upgrade (see open decision B1).
3. Write a **DR runbook** (`docs/` — full-DB restore steps, who does it, expected RTO/RPO).
4. Define and **test a single-tenant restore/export** procedure. The cleanest path
   reuses existing tenant-scoped logic: a script that dumps/loads all rows for one
   `tenantId` across the scoped tables. Run a real restore drill on a scratch project.
5. (Stretch) A scheduled logical backup (e.g. nightly `pg_dump` to Vercel Blob /
   object storage) as a belt-and-braces second copy independent of Supabase.

**Open decision B1:** upgrade Supabase tier for PITR now, or rely on daily snapshots
+ logical dumps until revenue justifies the upgrade? Depends on B's step 1 findings.

**Note:** much of this is configured *outside* the repo (Supabase dashboard, Vercel).
The deliverable in-repo is the **runbook + the tenant-restore script + a recorded drill**,
not infrastructure code.

---

## C. Consent records + DPA

**Corrected status (verified against code + git).** `TODO.md:74` claims a "cookie
consent banner shipped (`9fd250d`, `5c18c14`)" — **this overstates what shipped** and
should be corrected:

- `9fd250d` = in-site demo request form (not consent).
- `5c18c14` = the legal **pages** (`(legal)/politica-de-privacidade`,
  `politica-de-cookies`, `termos-e-condicoes`) **plus scoping PostHog to the
  authenticated dashboard** — it does *not* add a consent banner or toggle.

So the real picture is more defensible than "no consent at all":

- ✅ Privacy policy, cookie policy, and terms pages exist and are linked from the footer.
- ✅ PostHog (the only cookie-setting analytics) runs **only inside the logged-in
  dashboard**, not on the public marketing site. Vercel Analytics/Speed Insights are
  cookieless.
- ❌ No record of **terms / privacy acceptance** captured at user onboarding.
- ❌ No **Data Processing Agreement** for schools to sign at tenant onboarding
  (`TODO.md:57` still open — this is the genuine compliance gap for a B2B EU SaaS).
- ❔ No opt-out/consent control for the analytics cookies that *do* run in the
  dashboard. For authenticated B2B tooling this is arguably covered by legitimate
  interest + the cookie policy, but worth a deliberate decision rather than drift.

**Work to do.**
1. **Correct `TODO.md:74`** to reflect that only pages + PostHog-scoping shipped.
2. **DPA template** the school signs at tenant onboarding; store acceptance
   (signatory, version, timestamp) — likely a new `Consent`/`Agreement` row keyed by
   tenant.
3. **Recorded terms/privacy acceptance** at user onboarding (checkbox → stored
   version + timestamp). Schema: a small `consent`-style record per user or per
   membership (see workstream D — acceptance is arguably *per membership*).
4. **Decide on dashboard analytics consent** (open decision C1).

**Open decision C1:** for the authenticated dashboard, (a) keep analytics on under
legitimate interest with clear cookie-policy disclosure, (b) add a one-time opt-out in
settings, or (c) add an explicit opt-in. Recommend (a)+(b) for a B2B tool — low
friction, still respects objection. Needs your call.

**YAGNI:** no public-site cookie banner is needed while the public site sets no
non-essential cookies. Re-evaluate only if we add marketing pixels.

---

## D. Cross-tenant identity (one email, many tenants)

### D.1 Problem statement

A real person — typically a student or instructor — may legitimately belong to **more
than one driving school at the same time** (e.g. an instructor freelancing for two
schools, or a student who switched schools mid-course). Today they would need a
separate account per school, with separate logins. We want **one identity (one email,
one login)** that can hold **membership in multiple tenants simultaneously**, with a
potentially different role per tenant.

### D.2 Current architecture (why this is non-trivial)

Identity and membership are **fused** in the `User` model
(`prisma/schema.prisma:136`):

- `User.id` **is** the Supabase `auth.users.id` (line 137) — a load-bearing invariant.
- `User` carries `tenantId`, `schoolId`, `role` directly (one user = one tenant).
- Email is unique only *within* a tenant: `@@unique([tenantId, email])` (line 176).
- Per-tenant-ish profile lives on `User` too: `qualifiedCategories`, `novidadesSeenAt`.
- **All** downstream FKs point at `User.id`: `Enrollment.studentId`,
  `ClassSession.instructorId` / `createdById` / `updatedById`,
  `StudentCourse.studentId`, `Exam.instructorId` / `createdById` / `updatedById`,
  `Notification.userId`, `PushSubscription.userId`.
- The tenant-scope extension lists `User` in `TENANT_SCOPED_MODELS`
  (`src/server/lib/tenant-scope.ts:41`).

The `User.id == auth.users.id` invariant is relied on directly in code:
`supabaseAdmin.auth.admin.deleteUser(target.id)` in `user.delete` / `user.anonymize`
(`src/server/routers/user.ts:553,617`), `Sentry.setUser({ id })`, and platform-admin
admin creation.

Blast radius for any approach: **40 references to `ctx.user.role` / `ctx.user.schoolId`
/ `ctx.user.tenantId` across 7 router files** (`trpc.ts`, `user.ts`, `enrollment.ts`,
`novidades.ts`, `exam.ts`, `class.ts`, `course.ts`).

### D.3 Requirements & non-goals

**Requirements**
- One email = one login (one Supabase `auth.users` row), able to be active in N tenants.
- Role is **per tenant** (instructor in school A, student in school B is valid).
- Tenant isolation must remain absolute — being in tenant A grants nothing in tenant B.
- Existing tenant-scope guarantees and tests must keep holding.
- GDPR erasure must work **per tenant** without destroying the person's access to
  other tenants.

**Non-goals (YAGNI for v1)**
- A cross-tenant "switch school" UI inside the app — subdomain login is sufficient (see D.6).
- Per-tenant *display names* — a person has one name/phone globally.
- Self-serve "join another school" — staying invite/admin-driven matches the sales-led GTM.

### D.4 Approaches considered

#### Approach 1a — Membership separation, FKs stay on the global identity (RECOMMENDED)

Split `User` into a **global identity** + a **per-tenant membership**:

- **`User`** stays the global identity and **keeps `id == auth.users.id`** (invariant
  preserved). Holds: `id`, `email` (now **globally** unique), `name`, `phone`,
  timestamps. **Drops** `tenantId`, `schoolId`, `role`, `qualifiedCategories`,
  `novidadesSeenAt`.
- **`Membership`** (new, tenant-scoped): `id`, `userId → User`, `tenantId`,
  `schoolId`, `role`, `status`, `qualifiedCategories`, `novidadesSeenAt`, timestamps.
  `@@unique([tenantId, userId])`, indexes on `tenantId` / `schoolId` / `userId`.
- **Downstream FKs are UNCHANGED** — `studentId` / `instructorId` / `userId` keep
  pointing at the stable global `User.id`. Cross-tenant leakage is still prevented
  because those rows carry their own `tenantId` (already scoped by the extension).
- **tenant-scope extension:** remove `User` from `TENANT_SCOPED_MODELS`, add
  `Membership`. "Users in this tenant" is now a `Membership` query joined to `User`.
- **Auth/context:** `protectedProcedure` resolves current tenant (subdomain) + auth
  user, then loads the `Membership` for `(userId, tenantId)`. No membership ⇒ not a
  member of this tenant ⇒ 403. `ctx.membership.{role,schoolId,tenantId}` replaces the
  40 `ctx.user.*` reads.

**Pros:** preserves the `User.id == auth.users.id` invariant (Sentry, supabase admin
calls, conceptual clarity all keep working); downstream FKs untouched; the change is
isolated to the role-resolution layer + the user-management router; "all activity for
this human across tenants" stays a trivial query.

**Cons:** medium migration (new table + backfill + column drops + the 40-ref sweep);
`user.*` router procedures (create/list/deactivate/anonymize/exportData/studentProfile)
need real rework; `email` uniqueness changes from per-tenant to global.

#### Approach 1b — Membership separation, repoint FKs to `Membership.id`

As 1a, but `Enrollment.studentId` etc. point at `Membership.id` instead of `User.id`.

**Rejected:** semantically tidy but requires rewriting 7+ FKs and backfilling
`membershipId` across `Enrollment` / `ClassSession` / `StudentCourse` / `Exam` /
`Notification` / `PushSubscription` — much larger migration, and it makes the natural
"all activity for one human" query harder. No benefit over 1a for our needs.

#### Approach 2 — `Identity` above `User` (duplicate `User` rows per tenant)

Add an `Identity` table 1:1 with `auth.users`; `User` keeps `tenantId`/`role`/all
downstream FKs **but `User.id` stops being the auth uid** and gains `identityId →
Identity`. One `Identity` → many `User` rows (one per tenant).

**Pros:** the data layer (downstream FKs + tenant-scope, which keeps `User` scoped) is
untouched — smallest data-layer churn.

**Rejected:** it **breaks the `User.id == auth.users.id` invariant**, which is relied
on by `auth.admin.deleteUser(target.id)` (`user.ts:553,617`), `Sentry.setUser`, and
platform-admin creation — scattering changes across every auth-touching site.
Duplicates `name`/`phone` per tenant (drift risk). Two conceptual layers where 1a has
one clean split. The churn just moves from the router layer to the auth layer, and to
a *more dangerous* layer.

#### Approach 3 — Separate accounts per tenant (status quo, do nothing)

**Rejected:** separate logins/passwords per school is exactly the bad UX the
requirement exists to remove ("one email ... at the same time" implies a single login).

### D.5 Recommendation

**Approach 1a.** It preserves the most load-bearing invariant in the system
(`User.id == auth.users.id`), leaves the data-layer FKs and most of the tenant-scope
machinery intact, and confines the change to the membership/role-resolution layer plus
the user-management router — the parts already well covered by the isolation test
suite, so regressions are catchable.

### D.6 Auth & onboarding flow (under 1a)

- **Login** is unchanged at the Supabase layer (one `auth.users` row, one password).
- Tenant is resolved from the subdomain (existing middleware). After auth, look up the
  `Membership` for `(user, tenant)`:
  - membership exists → proceed as that role.
  - no membership → "You don't have access to this school" (don't leak existence).
- **Inviting an existing email to a second tenant** becomes: find-or-create the global
  `User` by email, then create a `Membership` — **no second auth user, no second
  password**. This is the core UX win and should be the headline behaviour of the
  `user.create` rework.
- **Tenant switching:** none in-app for v1. A person with two memberships simply visits
  the other school's subdomain and is already logged in (shared Supabase session
  across subdomains of the same root domain — verify cookie domain scoping).

### D.7 GDPR erasure under a shared identity (important nuance)

`user.anonymize` / `user.delete` currently assume one user = one tenant and delete the
auth row outright. Under 1a:

- Erasure requested by tenant A must anonymize/remove the person's **membership +
  tenant-A-scoped PII**, **not** the global identity if they still have an active
  membership elsewhere.
- The Supabase `auth.users` row (and the global `User`) may only be deleted when the
  person's **last** membership is gone.
- `exportData` should likewise be **membership-scoped** (export what tenant A holds),
  not the global cross-tenant view.

This must be explicit in the implementation plan — it's the easiest place to
accidentally delete a living account or leak cross-tenant data.

### D.8 Migration sketch (1a)

1. Add `Membership` table.
2. Backfill: one `Membership` per existing `User`, copying
   `tenantId`/`schoolId`/`role`/`qualifiedCategories`/`novidadesSeenAt`.
3. Flip `users.email` unique constraint from `(tenant_id, email)` to `(email)` —
   **requires a dedup check first** (can the same email already exist in two tenants
   today? If so, those must be reconciled to one identity before the global unique).
4. Drop the migrated columns from `users`.
5. Code: tenant-scope model set, `protectedProcedure`/context, the 40 `ctx.user.*`
   refs, the `user.*` router, anonymize/export/erasure semantics.
6. Tests: extend the isolation suite — same identity in two tenants sees only the
   correct tenant's data; erasure in A leaves B intact.

Given the prod migration-routing issue (workstream A), **this migration should not be
attempted on prod until A is resolved** — it's multi-step and exactly the kind of
change the manual hand-paste workflow handles worst.

### D.9 Open decisions

- **D1:** Which profile fields are truly global vs per-membership? Proposed: `name`,
  `phone`, `email` global; `role`, `qualifiedCategories`, `novidadesSeenAt`, `status`
  per-membership. Confirm `status` semantics (a person can be INACTIVE in A but ACTIVE
  in B).
- **D2:** Do we need the dedup reconciliation step (D.8 #3) — i.e. does the same email
  already exist across tenants in prod data? Must check before global-unique email.
- **D3:** Confirm Supabase session cookie domain scoping supports staying logged in
  across tenant subdomains (needed for D.6 switching UX).
- **D4:** Final call on 1a vs 1b (FKs on identity vs membership). Recommendation: 1a.

---

## 6. Sequencing

1. **A (migration routing)** — unblocks everything else that needs a schema change;
   also the highest live-risk item. Start the Supabase ticket immediately.
2. **B (backups/DR)** — independent of A; can run in parallel. Mostly verify +
   document + drill.
3. **C (consent/DPA)** — small schema (consent/agreement rows) + the `TODO.md:74`
   correction. The schema bit is cheap and can ride alongside B; the DPA template is
   non-code.
4. **D (cross-tenant identity)** — largest, and its migration depends on **A** being
   resolved. Design is approved here; write the implementation plan when A clears.

Each workstream gets its own implementation plan (`docs/superpowers/plans/`) when
picked up. D specifically should not start its prod migration until A is green.

---

## Appendix — corrections this spec makes to existing docs

- `TODO.md:74` — "cookie consent banner shipped" is inaccurate; only the legal pages +
  PostHog dashboard-scoping shipped. To be corrected (workstream C, step 1).
- `TODO.md:57` (DPA template) and the migration-routing KNOWN ISSUE in `CLAUDE.md`
  remain accurate and are folded into workstreams C and A respectively.

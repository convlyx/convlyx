# SEO Improvements — Spec

**Date:** 2026-07-13
**Status:** Ready to implement (separate chat — see handoff prompt at bottom)
**Owner:** Francisco

---

## Context & diagnosis

3 months of Google Search Console data (`convlyx.com`, Web, last 3 months) shows:

- **~305 impressions / ~33 clicks total** — roughly 3 impressions/day. The search market for our category is tiny.
- **We already rank on page 1**: homepage avg position **2.49** (CTR 15.9%), `/software-escola-conducao` position **6.18** (14 clicks, 184 impressions, CTR 7.6%).
- **Two underperformers**: `/gestao-alunos-conducao` (position 6.07, CTR **2.33%**) and `/calendario-aulas-conducao` (position 6.2, CTR **5%**).
- **Lusophone Africa signal**: Angola (CTR **27%**), Moçambique (**25%**), Cabo Verde (**33%**) — tiny impressions, very high CTR, ~position 4, near-zero local competition.
- Spanish query `software para escuelas de conducción` sits at position 67 — not our fight now.

**Conclusion:** This is a *demand* problem, not a *ranking* problem. SEO captures existing demand and our category has little. So the strategy is:
1. **Tune** what already ranks (lift CTR on the two weak pages) — cheap wins.
2. **Expand into informational top-of-funnel content** that driving-school staff actually google in daily work → pull owners in *before* they know our product category exists.
3. **Add PALOP geo pages** (Moçambique / Angola / Cabo Verde) — validated by our own click data, near-zero competition.

Keep effort proportional: SEO is a credibility/capture layer, **not** our primary growth engine (that's outbound sales — tracked separately).

## Current implementation (already in place — do NOT rebuild)

The SEO foundation is solid. Reuse these patterns:

- **Per-page metadata**: `export const metadata: Metadata` with `title`, `description`, `alternates.canonical`, `openGraph`, `twitter`. See `src/app/software-escola-conducao/page.tsx` as the reference.
- **JSON-LD**: `ORGANIZATION_SCHEMA` from `src/lib/seo-schema.ts`, plus per-page `BreadcrumbList` and `Service` schema injected via `<script type="application/ld+json">`.
- **Shared landing component**: `src/app/no-tenant/_components/seo-landing.tsx` (`<SeoLanding>`) — kicker, title, highlight, intro, hero mockup, features, midCta, deepDive, related. All three marketing pages use it.
- **Sitemap**: `src/app/sitemap.ts` (static list + `novidades` blog posts).
- **Robots**: `src/app/robots.ts` — allows standard + AI crawlers on apex only; blocks tenant subdomains.
- **Blog/changelog**: `src/app/novidades/` via `src/lib/novidades.ts` (`getAllPosts()`).

### ⚠️ Critical gotcha — middleware allowlist

Any **new apex-domain page** MUST be added to `MARKETING_EXACT_PATHS` in `src/middleware.ts` (line ~17), or it hard-404s in prod despite building fine locally. The apex is rewritten to `/no-tenant`; only allowlisted exact paths (plus `/novidades*`) are served as marketing routes. This has bitten us before.

---

## Work items

### A. Quick CTR wins on the two weak pages (highest ROI, do first)

Both rank ~position 6 but get few clicks. Rewrite `TITLE` and `DESCRIPTION` to be more benefit-led and specific. Keep them ≤60 chars (title) / ≤155 chars (description).

**`src/app/gestao-alunos-conducao/page.tsx`** — current title `"Gestão de alunos para escolas de condução | Convlyx"` (CTR 2.33%).
- Make the description lead with an outcome/number and add a soft CTA. Consider a title that includes a pain/benefit hook (e.g. presences, faltas, IMT).
- Proposed title direction: `"Gestão de alunos de escola de condução — presenças, faltas, IMT | Convlyx"` (trim to fit).

**`src/app/calendario-aulas-conducao/page.tsx`** — current title `"Calendário e agenda de aulas de condução | Convlyx"` (CTR 5%).
- Lead the description with the conflict-detection + notifications benefit.

Final copy is a judgment call — the implementer should draft 2–3 variants per page for Francisco to pick. **PT-PT only** (never PT-BR).

### B. FAQ schema + on-page FAQ blocks (rich-result CTR lift)

Add an `FAQPage` JSON-LD block + a visible FAQ section to each of the three marketing pages. FAQ rich results expand SERP real estate and lift CTR without needing higher rankings.

- Add a reusable `FaqSection` component (co-located under `no-tenant/_components/`) that renders the visible accordion **and** emits matching `FAQPage` JSON-LD (keep the two in sync — the schema must mirror the visible text or it violates Google's guidelines).
- 4–6 Q&As per page, targeting real long-tail queries: "Quanto custa um software para escola de condução?", "O Convlyx funciona com as categorias do IMT?", "Preciso de instalar alguma coisa?", etc.

### C. Informational top-of-funnel content (the real expansion)

Create informational articles/pages targeting what driving-school owners and staff actually google — not our product category. Publish via the existing `novidades` system **or** as new marketing pages (decide per piece; see note below). Candidate topics (validate volume with a keyword tool first):

- `modelo de contrato de formação de escola de condução` (offer a free downloadable template as a lead magnet → gated behind "pedir demo" or email)
- `quanto custa abrir uma escola de condução em Portugal`
- IMT exam scheduling rules / prazos de marcação de exame
- instructor certification requirements
- "como gerir uma escola de condução sem papel" (bridges to our product)

Each article should end with a soft conversion to "pedir demo". These pull top-of-funnel traffic that has more volume than our bottom-funnel product terms.

> **Note on `novidades` vs new pages:** `novidades` posts are already in the sitemap and don't need middleware changes. New apex pages give more control (custom metadata/schema) but **require the `MARKETING_EXACT_PATHS` edit** (gotcha above) and a `sitemap.ts` entry. Prefer `novidades` for articles; use new pages only for high-intent landing/geo pages.

### D. PALOP geo landing pages

Add geo-targeted variants for the markets already clicking:

- `/software-escola-conducao-mocambique` (primary — active deal in progress)
- Optionally Angola / Cabo Verde later.

For each: reuse `<SeoLanding>`, localized copy + `areaServed` in the `Service` schema pointing at the country, canonical URL, add to `MARKETING_EXACT_PATHS` **and** `sitemap.ts`. Keep copy PT-PT but market-aware (e.g. reference local context; avoid Portugal-only IMT framing as the headline for the Moçambique page — mention it works for any market's driving-school workflow).

> ⚠️ Coordinate with the Moçambique deal (separate track). Don't publish market-specific claims (pricing, local compliance) until confirmed. The auth/phone-login work is explicitly **out of scope** here.

### E. Housekeeping / technical checks

- Verify `og-image.png` exists at `https://convlyx.com/og-image.png` (referenced by all pages).
- Confirm every new page has a unique canonical + is in `sitemap.ts`.
- Confirm internal linking: each new page links to/from the existing three via the `related` prop.
- Run `pnpm lint` and `pnpm type-check` before declaring done (both gate CI).

## Out of scope

- Phone/WhatsApp auth (parked pending Moçambique meeting).
- Paid ads / outbound sales list (marketing track, not code).
- Spanish/Spain SEO.

## Definition of done

- [ ] A: 2–3 title/description variants drafted per weak page; Francisco picks; applied.
- [ ] B: `FaqSection` component built; FAQ + `FAQPage` schema live on all 3 marketing pages.
- [ ] C: ≥2 informational articles published via `novidades` with demo CTAs.
- [ ] D: Moçambique geo page live (allowlist + sitemap updated) — gated on deal confirmation.
- [ ] E: technical checks pass; `pnpm lint` + `pnpm type-check` green.

# Landing Page Revamp — Design Spec

**Date:** 2026-06-10
**Status:** Approved for planning
**Scope:** Visual + structural redesign of the public marketing landing page at `convlyx.com` (rendered by `src/app/no-tenant/_components/landing-page.tsx`).

---

## 1. Goal & Problem

The current landing page is competent but reads as a generic, "vibe-coded" AI SaaS template: ubiquitous emerald gradient orbs, six identical feature cards, three near-identical green bands, gradient-clipped headline text, and no narrative. It lacks personality and a clear story.

**Objective:** Give the page its own identity and a tighter narrative, while staying trust-first for the audience (Portuguese driving-school owners, often 40–60, not especially tech-forward). Distinctive **through craft and restraint**, not gimmicks.

**Approved direction (validated via visual mockups):** "Modern Editorial, warmed up" —
- Clean, confident, product-led.
- Green stays the brand, used with discipline (not gradient soup).
- A small amount of warmth from a sage canvas + a honey accent.
- Editorial personality from a serif-italic accent face used sparingly.

This is a **restructure + restyle**, not a from-scratch rebuild — we keep and refine the genuinely good parts (real product screenshots, FAQ, security story).

---

## 2. Visual System

All landing tokens are **scoped to the landing** (a wrapper class / CSS scope on the marketing pages) so the dashboard app theme (Inter, existing oklch palette) is untouched.

### 2.1 Color
- **Primary green** — reuse the existing theme `--primary` (oklch ≈ green hue 155). Forest variant for headings/CTAs (`#15803d`), primary (`#16a34a`).
- **Canvas** — soft green-tinted/sage off-white for warm sections (`--landing-canvas`, ≈ `#eef2ec`). White for others.
- **Honey accent** — warm `#f59e0b` / highlight `#fcd97a`, used **sparingly**: one keyword highlight, one warm stat/tag, a soft corner wash in the hero gradient. Never as body text on light backgrounds (contrast).
- **Ink** `#0f172a`, **muted** `#566156`.
- The hero background gradient (honey wash top-right + green glow top-left over sage) is an approved signature element.

### 2.2 Typography
- **Headings + UI:** Plus Jakarta Sans (geometric sans; bold, modern, readable across ages).
- **Accent words only:** Newsreader *italic* (e.g. the "*sem papel*" in the hero headline). Straight conventional 'l' — chosen over Fraunces, which had a loopy 'l' the stakeholder disliked.
- **Body:** Plus Jakarta Sans.
- Loaded via `next/font/google` in the root layout, exposed as `--font-jakarta` and `--font-newsreader` CSS variables, applied only within the landing scope. The app keeps Inter.
- No gradient-clipped text (a key "AI look" tell we are removing).

### 2.3 Shape & depth
- Rounded corners (cards `~14–16px`, buttons `~11px`, pills `999px`).
- Soft, low-opacity shadows tinted green (`rgba(16,80,40,.06–.12)`); no harsh drop shadows.
- Buttons: primary = solid green with soft green glow shadow (approved); secondary = white with hairline border.

### 2.4 Motion (restrained)
- Scroll-reveal (fade + small translate) on section entry via a shared `useReveal` IntersectionObserver hook.
- Hover lifts on cards (`transform`, not layout-affecting); 150–300ms transitions.
- One optional signature moment: honey highlight "drawing in" on the hero keyword.
- **`prefers-reduced-motion` respected** — reveals/animations disabled, content shown immediately.
- **No heavy animation library** in this pass. react-bits / Framer Motion are explicitly deferred; revisit only if a single signature flourish is wanted later. Rationale: restrained brief + the project's bundle-size discipline.

---

## 3. Page Structure

Narrative: **hook → trust → problem → what it does (shown, not told) → who it's for → how to start → safety → convert.**

| # | Section | Status | Notes |
|---|---------|--------|-------|
| 1 | Navegação | Restyle | Sticky, translucent, refined. Logo + anchor links + "Marcar demo". |
| 2 | Hero | New | Headline ("A tua escola, *sem papel* e sem stress"), subhead, two CTAs, **device duo**: laptop = backoffice, phone = mobile app. |
| 3 | Faixa de confiança | New | "Feito para escolas de condução portuguesas" + generic trust signals: RGPD · dados isolados por escola · apoio em PT. **No logos/quotes/counts** (none real yet). |
| 4 | O problema → a solução | New | Short editorial block: paper/scheduling chaos → everything digital in one place. Gives narrative. |
| 5 | Funcionalidades (bento) | Restyle | Calendário, alunos, presenças, notificações, relatórios, app — **bento grid** with varied sizes and real mini-UI. Replaces today's 6 identical cards. |
| 6 | Mostra do produto | Kept + restyle | Real backoffice + app screenshots in editorial frames, with lightbox. Reuses existing screenshot/lightbox system. |
| 7 | Para cada papel | New | Secretaria · Direção · Instrutores · Alunos — what each role gains. Speaks to the buyer. |
| 8 | Como funciona | Kept + restyle | 3 steps to start. |
| 9 | Segurança & multi-tenant | Kept + restyle | The single anchor green band: dados isolados, `escola.convlyx.com` subdomain, RGPD. |
| 10 | FAQ | Kept + restyle | Accordion (existing `<details>` pattern). |
| 11 | CTA final | Kept + restyle | "Marcar demonstração" + "já é cliente? entre em escola.convlyx.com". The second green band. |
| 12 | Rodapé | Kept | Reuse `SiteFooter` (links, legal, novidades, contacto). |

**Removed/merged from today:** the standalone stats bar and the "Why Convlyx" green band are folded into the trust strip (3) and problem→solution block (4), so the page no longer has three near-identical green bands (now just two: Security + final CTA).

**Out of scope (this pass):** pricing section, testimonials/logos, restyle of the separate SEO pages (`/software-escola-conducao`, `/calendario-aulas-conducao`, `/gestao-alunos-conducao`), legal pages, and the Novidades blog. These can adopt the new system in a later pass.

---

## 4. Component Architecture

Today's `landing-page.tsx` is one 1052-line client file. Break it into focused section components so each is understandable and editable in isolation.

```
src/app/no-tenant/_components/
  landing-page.tsx              # thin composition: scope wrapper + ordered sections + shared state (demoOpen)
  landing/
    landing-nav.tsx
    landing-hero.tsx            # headline + CTAs + device duo
    device-duo.tsx              # laptop + phone frames (reuses screenshot frames where possible)
    trust-strip.tsx
    problem-solution.tsx
    features-bento.tsx
    product-showcase.tsx        # reuses BrowserFrame / PhoneFrame / Lightbox
    roles-section.tsx
    how-it-works.tsx
    security-section.tsx
    faq-section.tsx
    final-cta.tsx
    _primitives/                # shared: SectionHeading, RevealOnScroll, Eyebrow, etc.
    use-reveal.ts               # IntersectionObserver hook
  demo-dialog.tsx               # reused as-is
  site-footer.tsx               # reused, light restyle
  mockups/                      # existing; reused/extended for device-duo
```

- **Reuse, don't rewrite:** `DemoDialog`, `SiteFooter`, the screenshot frame + `Lightbox` logic, and the `/public/screenshots/*` filename convention with placeholder fallback (existing `onError` pattern).
- `landing-page.tsx` keeps the cross-section client state it actually needs (`demoOpen`); the showcase tab/lightbox state moves into `product-showcase.tsx`.
- Sections that are purely static can be plain components; interactive ones stay `"use client"`. The page remains a client tree overall (it uses `useTranslations` + interaction), consistent with today.

---

## 5. Data, i18n, Accessibility, Performance

### Data
- No new data sources. Demo requests continue through the existing `DemoDialog` → `/api/demo-request` flow. No tRPC/schema changes.

### i18n (PT-PT)
- **All** user-facing strings are `next-intl` keys under `landing.*` in `messages/pt-PT.json`. Reuse existing landing keys where copy is unchanged; add new keys for new sections (trust strip, problem→solution, roles). **Zero hardcoded strings.**
- European Portuguese throughout ("escola de condução", "conduzir", "carta de condução").

### Accessibility
- Semantic landmarks (`<nav>`, `<main>`, `<section>`, `<footer>`), real `<button>`/`<a>`, labels on the demo form.
- Visible focus rings; keyboard-operable nav, tabs, accordion, lightbox (Escape to close — already implemented).
- Color never the sole indicator (status/role cues carry text + icon).
- Contrast ≥ 4.5:1 for text; honey used only as background/accent, not light-on-light text.
- `prefers-reduced-motion` honored.

### Performance
- Fonts via `next/font` (self-hosted, no layout shift, no external `@import`).
- Keep `preferredRegion = "dub1"` pinning on the route/layout (per project perf rules).
- Lazy/`loading="lazy"` on below-the-fold screenshots; reserve aspect-ratio boxes to avoid CLS (existing frames already fix aspect).
- No heavy animation dependency added.

---

## 6. Verification

- `npm run lint` and `npm run type-check` both pass (both gate CI).
- `npm run build` succeeds.
- Manual pass at 375 / 768 / 1024 / 1440px: no horizontal scroll, device duo reflows sensibly, nav anchors scroll correctly.
- Light + dark mode checked (landing is primarily light; ensure tokens resolve and contrast holds).
- `prefers-reduced-motion` verified (reveals disabled).
- Screenshot placeholders still render when image files are absent (fallback intact).
- Visual parity with the approved mockups (hero, fonts, palette).

---

## 7. Open Tweaks (post-implementation, low priority)

Stakeholder noted these can be adjusted later once it's live: warmth amount (honey intensity), device sizing/overlap in the hero, exact headline wording, badge copy. The build targets the approved mockup; fine-tuning happens after.

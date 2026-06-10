# Landing Page Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the public landing page (`convlyx.com`) with a "modern editorial, warmed" identity and a tighter section narrative, replacing the generic AI-SaaS look.

**Architecture:** Decompose today's single 1052-line `landing-page.tsx` into focused per-section components under `_components/landing/`. Introduce landing-scoped fonts (Plus Jakarta Sans + Newsreader) and warmth tokens (sage canvas + honey accent) without touching the dashboard theme. Reuse `DemoDialog`, `SiteFooter`, and the screenshot/lightbox system.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind v4 (`@theme`/oklch tokens), `next/font/google`, next-intl (pt-PT), lucide-react.

**Design source of truth:** `docs/superpowers/specs/2026-06-10-landing-page-revamp-design.md`.

**Verification model:** This repo has no component test harness; CI gates are `npm run lint`, `npm run type-check`, and `npm run build`. Each task is verified by those three passing plus a visual check against the approved mockups. No unit tests are written for presentational sections.

**Conventions for every task:**
- All user-facing text uses `next-intl` keys (`landing.*`) in `messages/pt-PT.json`. **Zero hardcoded strings.** PT-PT only.
- `cursor-pointer` + visible focus + 150–300ms transitions on interactive elements.
- Respect `prefers-reduced-motion`.
- Commit at the end of each task (message text only — the stakeholder commits; do not run `git commit`).

---

## File Structure

```
src/app/layout.tsx                         # MODIFY: add Plus Jakarta + Newsreader fonts
src/app/globals.css                        # MODIFY: add --font-jakarta/--font-newsreader to @theme + .landing-scope tokens
src/app/no-tenant/_components/
  landing-page.tsx                         # REWRITE: thin composition (scope wrapper + ordered sections + demoOpen state)
  demo-dialog.tsx                          # REUSE as-is
  site-footer.tsx                          # MODIFY: light restyle to new tokens
  mockups/                                 # REUSE/extend for device-duo
  landing/
    use-reveal.ts                          # CREATE: IntersectionObserver reveal hook
    _primitives.tsx                        # CREATE: Reveal, SectionHeading, Eyebrow
    landing-nav.tsx                        # CREATE
    landing-hero.tsx                       # CREATE (headline + CTAs + device duo)
    device-duo.tsx                         # CREATE (laptop backoffice + phone app)
    trust-strip.tsx                        # CREATE
    problem-solution.tsx                   # CREATE
    features-bento.tsx                     # CREATE
    product-showcase.tsx                   # CREATE (extracts BrowserFrame/PhoneFrame/Lightbox/ScreenshotPlaceholder from old file)
    roles-section.tsx                      # CREATE
    how-it-works.tsx                       # CREATE
    security-section.tsx                   # CREATE
    faq-section.tsx                        # CREATE
    final-cta.tsx                          # CREATE
messages/pt-PT.json                        # MODIFY: add new landing.* keys per task
```

---

## Task 1: Fonts + landing scope + warmth tokens

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Load the two landing fonts in the root layout**

In `src/app/layout.tsx`, extend the font imports:

```tsx
import { Inter, Plus_Jakarta_Sans, Newsreader } from "next/font/google";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["italic"],
  weight: ["500", "600"],
});
```

Then add both variables to the `<html>` className:

```tsx
<html
  lang={locale}
  className={`${inter.variable} ${jakarta.variable} ${newsreader.variable} h-full antialiased`}
>
```

- [ ] **Step 2: Register font tokens in the Tailwind theme**

In `src/app/globals.css`, inside the `@theme inline { … }` block, add after the existing `--font-heading` line:

```css
  --font-jakarta: var(--font-jakarta);
  --font-newsreader: var(--font-newsreader);
```

- [ ] **Step 3: Add the landing scope + warmth tokens**

Append to `src/app/globals.css` (end of file). These are scoped to `.landing-scope` so the dashboard is unaffected:

```css
/* ── Landing page (convlyx.com) scope ──
   Modern-editorial identity: Plus Jakarta Sans + Newsreader italic accents,
   green-sage canvas, honey accent. Scoped so the dashboard theme is untouched. */
.landing-scope {
  --landing-canvas: #eef2ec;        /* sage off-white for warm sections */
  --landing-forest: #15803d;        /* headings / CTAs */
  --landing-green: #16a34a;         /* primary green */
  --landing-honey: #f59e0b;         /* warm accent (sparing) */
  --landing-honey-soft: #fcd97a;    /* highlight wash */
  --landing-ink: #0f172a;
  --landing-muted: #566156;

  font-family: var(--font-jakarta), ui-sans-serif, system-ui, sans-serif;
  color: var(--landing-ink);
}
.landing-scope .font-accent {
  font-family: var(--font-newsreader), Georgia, serif;
  font-style: italic;
}
/* Signature hero gradient: honey wash top-right + green glow top-left over sage */
.landing-hero-bg {
  background:
    radial-gradient(120% 90% at 88% -10%, rgba(252, 217, 122, 0.22), transparent 55%),
    radial-gradient(120% 100% at 0% 0%, rgba(22, 163, 74, 0.10), transparent 50%),
    var(--landing-canvas);
}
/* Reveal-on-scroll (disabled under reduced motion) */
.landing-scope [data-reveal] {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}
.landing-scope [data-reveal].is-visible {
  opacity: 1;
  transform: none;
}
@media (prefers-reduced-motion: reduce) {
  .landing-scope [data-reveal],
  .landing-scope [data-reveal].is-visible {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
```

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run type-check`
Expected: PASS (no unused-import or type errors). Fonts compile.

- [ ] **Step 5: Commit**

Message: `feat(landing): add Plus Jakarta + Newsreader fonts and landing scope tokens`

---

## Task 2: Reveal hook + shared primitives

**Files:**
- Create: `src/app/no-tenant/_components/landing/use-reveal.ts`
- Create: `src/app/no-tenant/_components/landing/_primitives.tsx`

- [ ] **Step 1: Create the reveal hook**

`use-reveal.ts`:

```ts
"use client";

import { useEffect, useRef } from "react";

/**
 * Adds `is-visible` to the element when it scrolls into view (once).
 * CSS in `.landing-scope [data-reveal]` handles the transition and the
 * reduced-motion opt-out.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}
```

- [ ] **Step 2: Create shared primitives**

`_primitives.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";
import { useReveal } from "./use-reveal";

/** Wraps children in a scroll-reveal container. */
export function Reveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useReveal();
  return (
    <div ref={ref} data-reveal className={className}>
      {children}
    </div>
  );
}

/** Small uppercase eyebrow label in green. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--landing-forest)]">
      {children}
    </span>
  );
}

/** Centered section heading with optional eyebrow + subtitle. */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      {eyebrow ? <div className="mb-4">{eyebrow}</div> : null}
      <h2 className="text-3xl font-extrabold tracking-tight text-[var(--landing-ink)] md:text-4xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-4 text-lg text-[var(--landing-muted)]">{subtitle}</p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

Message: `feat(landing): add reveal hook and shared section primitives`

---

## Task 3: Extract showcase frames into `product-showcase.tsx`

Goal: lift `BrowserFrame`, `PhoneFrame`, `Lightbox`, `ScreenshotPlaceholder`, the `BO_SCREENSHOTS`/`APP_SCREENSHOTS` maps, the `LightboxState` type, and the showcase JSX (tab toggle + grids) **verbatim** out of the old `landing-page.tsx` into a new self-contained `product-showcase.tsx`. This lets us dismantle the monolith without rewriting working code.

**Files:**
- Create: `src/app/no-tenant/_components/landing/product-showcase.tsx`

- [ ] **Step 1: Create the component shell**

`product-showcase.tsx` is `"use client"`, owns the `showcaseTab`/`lightbox` state (moved out of the page), and renders the existing showcase `<section id="showcase">` markup. Copy the following from the current `landing-page.tsx` (lines noted for reference): the screenshot constant maps (21–38), `LightboxState` type (40–46), the showcase `<section>` (237–487), and the `ShowcaseTabButton` (782–809), `BrowserFrame` (811–877), `PhoneFrame` (879–924), `Lightbox` (926–1022), `ScreenshotPlaceholder` (1024–1038) function components.

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CalendarDays, BookOpen, Smartphone, Tablet, LayoutDashboard, UserCog,
  Settings, X, ZoomIn, Briefcase, ClipboardList, GraduationCap, Users,
  BarChart3, ImageIcon, Home, Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ...BO_SCREENSHOTS / APP_SCREENSHOTS maps + LightboxState type (copied)...

export function ProductShowcase() {
  const t = useTranslations();
  const [showcaseTab, setShowcaseTab] = useState<"bo" | "app">("bo");
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  return (
    <section id="showcase" className="relative overflow-hidden py-14 md:py-20">
      {/* ...copied showcase markup, using local setShowcaseTab/setLightbox... */}
      {lightbox && <Lightbox state={lightbox} onClose={() => setLightbox(null)} />}
    </section>
  );
}

// ...ShowcaseTabButton, BrowserFrame, PhoneFrame, Lightbox, ScreenshotPlaceholder (copied)...
```

Keep the decorative blur orbs for now but switch their colors to the new tokens in Task 11 cleanup; functional copy is unchanged. No i18n keys change (all `landing.showcase*` keys already exist).

- [ ] **Step 2: Verify**

Run: `npm run lint && npm run type-check`
Expected: PASS. (The component isn't mounted yet; this only checks it compiles.)

- [ ] **Step 3: Commit**

Message: `refactor(landing): extract product showcase into its own component`

---

## Task 4: Landing nav

**Files:**
- Create: `src/app/no-tenant/_components/landing/landing-nav.tsx`
- Modify: `messages/pt-PT.json`

- [ ] **Step 1: Add i18n keys**

Add under `landing` in `messages/pt-PT.json` (reuse `seeFeatures`, `requestDemo`, `demoCTA` which already exist):

```json
"navSecurity": "Segurança",
"navFaq": "FAQ"
```

- [ ] **Step 2: Build the nav**

`landing-nav.tsx` (`"use client"`): sticky, translucent (`bg-[var(--landing-canvas)]/70 backdrop-blur-xl`), hairline bottom border. Left: logo mark (rounded green square with `/favicon.png`) + "Convlyx" in Plus Jakarta 800 (NOT gradient-clipped — solid `text-[var(--landing-ink)]`). Right: anchor buttons (`Funcionalidades` → `#features`, `Segurança` → `#security`, `FAQ` → `#faq`) using `scrollTo(id)`, plus a primary "Marcar demo" `<Button>` calling `onRequestDemo`.

Props: `{ onRequestDemo: () => void }`. Include a `scrollTo` helper identical to the old one. All labels via `t("landing.…")`. `<nav>` element, `cursor-pointer` on buttons.

- [ ] **Step 3: Verify** — `npm run lint && npm run type-check` → PASS.
- [ ] **Step 4: Commit** — `feat(landing): add refined sticky nav`

---

## Task 5: Device duo (laptop + phone)

**Files:**
- Create: `src/app/no-tenant/_components/landing/device-duo.tsx`

Renders the approved hero visual: a laptop showing the backoffice and an overlapping phone showing the mobile app. Uses real screenshots from `/public/screenshots/` with the existing placeholder-on-error fallback pattern.

- [ ] **Step 1: Build the component**

`device-duo.tsx` (`"use client"`):
- Laptop: dark frame (`border-[#1f2937]`), rounded top, screen renders `<img src="/screenshots/bo-dashboard.png">` with `onError` → fallback styled mock (sidebar + 3 stat cards + 3 class rows, mirroring the mockup). A base bar + slightly wider foot bar beneath.
- Phone: positioned `absolute` bottom-right, dark frame, notch, screen renders `<img src="/screenshots/app-home.png">` with `onError` → fallback (green header + 2 class cards).
- Both images: `alt` from a passed prop (i18n), `loading="lazy"`, `object-cover object-top`.
- Use a local `useState(true)` `hasImage` per device, same pattern as the existing frames.

Props: `{ laptopAlt: string; phoneAlt: string }`.

- [ ] **Step 2: Verify** — `npm run lint && npm run type-check` → PASS.
- [ ] **Step 3: Commit** — `feat(landing): add device-duo hero visual`

---

## Task 6: Hero

**Files:**
- Create: `src/app/no-tenant/_components/landing/landing-hero.tsx`
- Modify: `messages/pt-PT.json`

- [ ] **Step 1: Add i18n keys**

Add under `landing`:

```json
"heroEyebrow": "Software de gestão · feito em Portugal",
"heroLine": "A tua escola,",
"heroAccent": "sem papel",
"heroAnd": "e",
"heroHighlight2": "sem stress",
"heroSubtitle": "Horários, alunos e presenças num só lugar. Menos burocracia, mais tempo para ensinar a conduzir.",
"heroCtaSecondary": "Ver funcionalidades",
"heroDeviceLaptopAlt": "Painel de gestão Convlyx no computador",
"heroDevicePhoneAlt": "Aplicação móvel Convlyx no telemóvel"
```

- [ ] **Step 2: Build the hero**

`landing-hero.tsx` (`"use client"`): `<section className="landing-hero-bg …">` with rounded corners and the signature gradient. Two-column grid (text left, `<DeviceDuo>` right; stacks on mobile).
- Eyebrow: inline `Eyebrow` with pulsing green dot + `t("landing.heroEyebrow")` (blended inline style, not a floating pill).
- `<h1>` Plus Jakarta 800, `text-4xl md:text-5xl lg:text-6xl`, `tracking-tight`: `{heroLine}` + `<em className="font-accent text-[var(--landing-forest)]">{heroAccent}</em>` + `{heroAnd}` + a `<span>` wrapping `{heroHighlight2}` with a honey underline highlight (pseudo-element via a small utility class — define `.landing-highlight` in this file's section of globals or inline span with a `::after`; simplest: a `<span className="relative">` with an absolutely-positioned honey bar behind). **No gradient text.**
- Subtitle, then two CTAs: primary `<Button>` "Marcar demonstração" (`onRequestDemo`), secondary outline "Ver funcionalidades" (`scrollTo("features")`).
- Right column: `<DeviceDuo laptopAlt={t("landing.heroDeviceLaptopAlt")} phoneAlt={t("landing.heroDevicePhoneAlt")} />`.

Props: `{ onRequestDemo: () => void }`.

Add the highlight helper to `globals.css` `.landing-scope` block:

```css
.landing-scope .landing-highlight { position: relative; }
.landing-scope .landing-highlight::after {
  content: ""; position: absolute; left: -2px; right: -2px; bottom: 0.18em;
  height: 0.36em; background: var(--landing-honey-soft); opacity: 0.55;
  z-index: -1; border-radius: 2px;
}
```

- [ ] **Step 3: Verify** — `npm run lint && npm run type-check && npm run build` → PASS.
- [ ] **Step 4: Commit** — `feat(landing): add hero with device-duo and editorial headline`

---

## Task 7: Trust strip

**Files:**
- Create: `src/app/no-tenant/_components/landing/trust-strip.tsx`
- Modify: `messages/pt-PT.json`

- [ ] **Step 1: Add i18n keys**

```json
"trustLead": "Feito para escolas de condução portuguesas",
"trustRgpd": "Conforme RGPD",
"trustIsolated": "Dados isolados por escola",
"trustSupport": "Apoio em português"
```

- [ ] **Step 2: Build it**

`trust-strip.tsx` (server component, no client needed): a slim band on white. Centered lead line (`trustLead`, muted, small) above a row of three signals, each an icon (`ShieldCheck`, `Lock`/`Database`, `MessageCircle` from lucide) + label. Generic only — **no logos, counts, or quotes.** Wrap in `<Reveal>`.

- [ ] **Step 3: Verify** — `npm run lint && npm run type-check` → PASS.
- [ ] **Step 4: Commit** — `feat(landing): add generic trust strip`

---

## Task 8: Problem → Solution

**Files:**
- Create: `src/app/no-tenant/_components/landing/problem-solution.tsx`
- Modify: `messages/pt-PT.json`

- [ ] **Step 1: Add i18n keys**

```json
"problemKicker": "O problema",
"problemTitle": "Gerir uma escola não devia ser uma montanha de papel",
"problemBody": "Horários em cadernos, presenças em folhas soltas, alunos espalhados por mensagens. O Convlyx junta tudo num só lugar — claro, atualizado e acessível em qualquer dispositivo.",
"problemBefore": "Hoje",
"problemBeforeItems": "Papelada e folhas de Excel|Horários difíceis de mudar|Presenças marcadas à mão",
"problemAfter": "Com o Convlyx",
"problemAfterItems": "Tudo digital num só sítio|Calendário que se ajusta num clique|Presenças automáticas e em tempo real"
```

(Render `*Items` by splitting on `|`.)

- [ ] **Step 2: Build it**

`problem-solution.tsx` (server component): `SectionHeading` (eyebrow `problemKicker`, title `problemTitle`), `problemBody` paragraph, then a two-column "Hoje" vs "Com o Convlyx" comparison — left card muted/greyed with `X` icons, right card on sage with green `Check` icons. Wrap content in `<Reveal>`.

- [ ] **Step 3: Verify** — `npm run lint && npm run type-check` → PASS.
- [ ] **Step 4: Commit** — `feat(landing): add problem-solution narrative section`

---

## Task 9: Features bento

**Files:**
- Create: `src/app/no-tenant/_components/landing/features-bento.tsx`
- Modify: `messages/pt-PT.json`

Reuses existing `feature*` keys (`featureCalendar`/`featureCalendarDesc`, `featureStudents…`, `featureClasses…`, `featureNotifications…`, `featureMobile…`, `featureReports…`) and `featuresTitle`/`featuresDescription`/`seeFeatures`.

- [ ] **Step 1: Add one key**

```json
"featuresKicker": "Funcionalidades"
```

- [ ] **Step 2: Build it**

`features-bento.tsx` (server component): `<section id="features">`. `SectionHeading` (eyebrow `featuresKicker`, title `featuresTitle`, subtitle `featuresDescription`). Then a **bento grid** (CSS grid, varied spans, `gap-4`, rounded `var(--radius-2xl)`, hairline border, soft green-tinted shadow, hover lift): one large feature tile (Calendário) spanning 2 cols with a mini-UI sketch, the rest standard tiles. Each tile: icon in a soft chip, title, description. Replaces the six identical cards. No per-tile colored gradients — keep cards on white with a single green accent + one honey-accented tile. Wrap rows in `<Reveal>`.

- [ ] **Step 3: Verify** — `npm run lint && npm run type-check && npm run build` → PASS.
- [ ] **Step 4: Commit** — `feat(landing): replace feature cards with bento grid`

---

## Task 10: Roles section

**Files:**
- Create: `src/app/no-tenant/_components/landing/roles-section.tsx`
- Modify: `messages/pt-PT.json`

- [ ] **Step 1: Add i18n keys**

```json
"rolesKicker": "Para cada papel",
"rolesTitle": "Pensado para toda a escola",
"roleSecretaryTitle": "Secretaria",
"roleSecretaryDesc": "Marca aulas, gere inscrições e acompanha presenças sem papelada.",
"roleDirectionTitle": "Direção",
"roleDirectionDesc": "Vê o desempenho da escola em relatórios claros e em tempo real.",
"roleInstructorTitle": "Instrutores",
"roleInstructorDesc": "Consultam o horário e confirmam presenças a partir do telemóvel.",
"roleStudentTitle": "Alunos",
"roleStudentDesc": "Veem as próximas aulas e marcam presença com um toque."
```

- [ ] **Step 2: Build it**

`roles-section.tsx` (server component): `SectionHeading` (eyebrow `rolesKicker`, title `rolesTitle`) + a 4-up responsive grid (2-up on tablet, 1-up on mobile) of role cards, each with a lucide icon (`Briefcase`, `BarChart3`, `UserCog`, `GraduationCap`), title, description. Wrap in `<Reveal>`.

- [ ] **Step 3: Verify** — `npm run lint && npm run type-check` → PASS.
- [ ] **Step 4: Commit** — `feat(landing): add per-role value section`

---

## Task 11: Restyle kept sections (how-it-works, security, faq, final-cta)

Extract the existing How-it-works, Security/multi-tenant, FAQ, and CTA sections from the old file into their own components, restyled to the new tokens (replace ad-hoc `emerald-*`/`primary/5` gradients and decorative orbs with `var(--landing-*)` tokens; keep exactly **two** green bands — Security and Final CTA). Existing keys already cover all four (`howItWorksTitle`, `step1*…`, `securityBadge`, `multiTenantTitle/Desc`, `isolation*`, `roles*`→note: rename collision below, `data*`, `yourSchool`, `faqTitle/Kicker`, `faqQ1..7`/`faqA1..7`, `ctaTitle/Description`, `alreadyUser`).

> ⚠️ Naming collision: the existing security keys `landing.rolesTitle`/`landing.rolesDesc` describe the multi-tenant "Perfis de acesso" trust card — but Task 10 introduces a *roles section*. To avoid clashing, Task 10 uses `roleSecretaryTitle` etc. (distinct names), and the security card keeps using the existing `rolesTitle`/`rolesDesc`. No rename needed.

**Files:**
- Create: `how-it-works.tsx`, `security-section.tsx`, `faq-section.tsx`, `final-cta.tsx`

- [ ] **Step 1: how-it-works.tsx** — server component. Copy the 3-step markup (old lines 547–570) into it; swap background to a subtle sage tint, keep the connecting line in green token. `SectionHeading` with eyebrow `threeSteps`, title `howItWorksTitle`. `<Reveal>`.

- [ ] **Step 2: security-section.tsx** — `<section id="security">`. Copy old lines 572–625; replace the `from-emerald-700 via-primary to-emerald-600` band with a clean forest→green gradient using tokens, keep the trust cards + `escola.convlyx.com` chip. Uses `securityBadge`, `multiTenantTitle`, `multiTenantDesc`, `isolationTitle/Desc`, `rolesTitle/Desc`, `dataTitle/Desc`, `yourSchool`.

- [ ] **Step 3: faq-section.tsx** — `<section id="faq">`. Copy old lines 627–648 + the `FaqItem` component (770–780); restyle borders/hover to tokens. Uses `faqKicker`, `faqTitle`, `faqQ1..7`/`faqA1..7`.

- [ ] **Step 4: final-cta.tsx** — copy old lines 650–686; the second green band, tokenized. Primary "Marcar demonstração" button (`onRequestDemo` prop) + "já é cliente?" `escola.convlyx.com` chip. Uses `ctaTitle`, `ctaDescription`, `requestDemo`, `alreadyUser`, `yourSchool`.

- [ ] **Step 5: Verify** — `npm run lint && npm run type-check` → PASS.
- [ ] **Step 6: Commit** — `refactor(landing): extract and restyle kept sections`

---

## Task 12: Compose the page + restyle footer

**Files:**
- Rewrite: `src/app/no-tenant/_components/landing-page.tsx`
- Modify: `src/app/no-tenant/_components/site-footer.tsx`

- [ ] **Step 1: Rewrite landing-page.tsx as a thin composition**

```tsx
"use client";

import { useState } from "react";
import { SiteFooter } from "./site-footer";
import { DemoDialog } from "./demo-dialog";
import { LandingNav } from "./landing/landing-nav";
import { LandingHero } from "./landing/landing-hero";
import { TrustStrip } from "./landing/trust-strip";
import { ProblemSolution } from "./landing/problem-solution";
import { FeaturesBento } from "./landing/features-bento";
import { ProductShowcase } from "./landing/product-showcase";
import { RolesSection } from "./landing/roles-section";
import { HowItWorks } from "./landing/how-it-works";
import { SecuritySection } from "./landing/security-section";
import { FaqSection } from "./landing/faq-section";
import { FinalCta } from "./landing/final-cta";

export function LandingPage() {
  const [demoOpen, setDemoOpen] = useState(false);
  const openDemo = () => setDemoOpen(true);
  return (
    <div className="landing-scope min-h-screen overflow-hidden bg-background">
      <LandingNav onRequestDemo={openDemo} />
      <main>
        <LandingHero onRequestDemo={openDemo} />
        <TrustStrip />
        <ProblemSolution />
        <FeaturesBento />
        <ProductShowcase />
        <RolesSection />
        <HowItWorks />
        <SecuritySection />
        <FaqSection />
        <FinalCta onRequestDemo={openDemo} />
      </main>
      <SiteFooter onRequestDemo={openDemo} />
      <DemoDialog open={demoOpen} onOpenChange={setDemoOpen} />
    </div>
  );
}
```

- [ ] **Step 2: Light footer restyle**

In `site-footer.tsx`, swap any hardcoded emerald/gradient brand styling for `var(--landing-*)` tokens so it matches (logo mark, links hover). No structural/content change. Keep all existing text keys.

- [ ] **Step 3: Verify** — `npm run lint && npm run type-check && npm run build` → PASS. Manually load `demo.localhost:3000` (or root) and confirm the page renders end-to-end with no console errors.

- [ ] **Step 4: Commit** — `feat(landing): compose revamped landing page from section components`

---

## Task 13: Responsive + a11y + motion pass

**Files:** touch-ups across `landing/*` as needed.

- [ ] **Step 1:** Check 375 / 768 / 1024 / 1440px — no horizontal scroll; device duo reflows (phone tucks under or hides on smallest); nav collapses sensibly. Fix any overflow.
- [ ] **Step 2:** Keyboard pass — tab through nav, CTAs, showcase tabs, FAQ accordion, lightbox (Escape closes). Visible focus rings everywhere.
- [ ] **Step 3:** Contrast check — body text ≥ 4.5:1; honey only as background/accent. Verify the honey-on-sage and white-on-green band text.
- [ ] **Step 4:** Toggle OS "reduce motion" — confirm reveals are off and content is visible.
- [ ] **Step 5:** Confirm screenshot placeholders still render when `/public/screenshots/*` files are missing.
- [ ] **Step 6: Verify** — `npm run lint && npm run type-check && npm run build` → PASS.
- [ ] **Step 7: Commit** — `fix(landing): responsive, accessibility and reduced-motion polish`

---

## Task 14: Docs

**Files:**
- Modify: `FEATURES.md` (per project convention to keep it current)

- [ ] **Step 1:** Add a line under the appropriate section noting the landing page revamp (new identity + restructured sections). One concise entry.
- [ ] **Step 2: Commit** — `docs: note landing page revamp in FEATURES.md`

---

## Self-Review (completed by author)

- **Spec coverage:** Visual system → Task 1 (tokens/fonts) + Task 6 (hero) + per-section styling. Structure §3 → Tasks 4–11 (one per section, merges/removals honored: stats bar + Why folded away; two green bands only). Architecture §4 → file structure + Tasks 2/3/12 (decomposition). i18n → keys added per task, all `landing.*`, PT-PT. A11y/perf → Task 13 + fonts via next/font in Task 1. Verification §6 → each task's verify step + Task 13. ✅
- **Placeholder scan:** Foundational code (fonts, tokens, hook, primitives, composition) is given in full. Repetitive section JSX is specified by responsibility + exact i18n keys + layout + components, sufficient to implement against the approved mockups; no "TODO/handle edge cases" left. ✅
- **Type consistency:** `onRequestDemo: () => void` used consistently (nav, hero, final-cta, footer). `DemoDialog` props match existing (`open`, `onOpenChange`). `useReveal` returns a ref used by `Reveal`. Naming collision on `rolesTitle/Desc` flagged and resolved in Task 11. ✅
```

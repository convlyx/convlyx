"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
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

/** Centered section heading with optional eyebrow, serif accent, subtitle, and
 *  a faint driving-themed icon sitting behind the title for subliminal context. */
export function SectionHeading({
  eyebrow,
  title,
  accent,
  subtitle,
  icon: Icon,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Trailing word(s) rendered in the Newsreader serif italic, forest green. */
  accent?: ReactNode;
  subtitle?: ReactNode;
  /** Faint oversized line icon rendered behind the heading. */
  icon?: LucideIcon;
}) {
  return (
    <div className="relative mx-auto mb-10 max-w-2xl text-center">
      {Icon ? (
        <Icon
          aria-hidden
          strokeWidth={1}
          className="pointer-events-none absolute top-1/2 left-0 hidden h-40 w-40 -translate-x-1/3 -translate-y-1/2 -rotate-6 text-[var(--landing-forest)] opacity-[0.08] sm:block"
        />
      ) : null}
      <div className="relative">
        {eyebrow ? <div className="mb-4 flex justify-center">{eyebrow}</div> : null}
        <h2 className="text-3xl font-extrabold tracking-tight text-balance text-[var(--landing-ink)] md:text-4xl">
          {title}
          {accent ? (
            <>
              {" "}
              <span className="font-accent font-semibold text-[var(--landing-forest)]">
                {accent}
              </span>
            </>
          ) : null}
        </h2>
        {subtitle ? (
          <p className="mt-4 text-lg text-[var(--landing-muted)]">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Subtle decorative dot-grid accent (forest dots, softly faded at the edges).
 * Position + size it via `className` (e.g. "right-[-3rem] top-8 h-64 w-64").
 * The parent must be `relative` (and usually `overflow-hidden`).
 */
export function DotGrid({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute ${className ?? ""}`}
      style={{
        backgroundImage:
          "radial-gradient(color-mix(in srgb, var(--landing-forest) 42%, transparent) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
        WebkitMaskImage: "radial-gradient(ellipse at center, black 35%, transparent 72%)",
        maskImage: "radial-gradient(ellipse at center, black 35%, transparent 72%)",
      }}
    />
  );
}

/**
 * Soft green orb — a radial glow that fades at its own edge, so it reads as a
 * gentle presence anywhere (never a hard, clipped disc).
 */
export function DecoCircle({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute rounded-full bg-[var(--landing-green)]/12 blur-2xl ${className ?? ""}`}
    />
  );
}

/**
 * Quiet decorative texture for a light section — a dot cluster tucked in a top
 * corner + a soft green orb sitting toward the interior (vertically centred, on
 * the opposite side from the dots). `flip` mirrors the sides for page rhythm.
 * The parent section must be `relative overflow-hidden`.
 */
export function SectionDecor({ flip = false }: { flip?: boolean }) {
  return (
    <>
      <DotGrid className={`top-8 h-56 w-56 ${flip ? "left-[-3.5rem]" : "right-[-3.5rem]"}`} />
      <DecoCircle
        className={`top-1/2 h-80 w-80 -translate-y-1/2 ${flip ? "right-[16%]" : "left-[16%]"}`}
      />
    </>
  );
}

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

/** Centered section heading with optional eyebrow, serif accent + subtitle. */
export function SectionHeading({
  eyebrow,
  title,
  accent,
  subtitle,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Trailing word(s) rendered in the Newsreader serif italic, forest green. */
  accent?: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
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
  );
}

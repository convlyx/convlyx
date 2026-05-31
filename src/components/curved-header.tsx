import { cn } from "@/lib/utils";

/**
 * Branded emerald panel with a wave that swoops into the surface below it.
 *
 * The wave is filled with the page background (`var(--background)`) so the
 * panel blends seamlessly into whatever sits underneath. Reused by the mobile
 * auth hero and the in-app screen headers so the curved-header language stays
 * in one place.
 *
 * Place the panel directly above a `bg-background` surface; a 1px overlap
 * (e.g. `-mt-px` on the surface below) avoids any sub-pixel seam.
 */
export function CurvedHeader({
  children,
  className,
  style,
  wave = true,
}: {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  wave?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-emerald-700 text-primary-foreground",
        className,
      )}
      style={style}
    >
      {children}
      {wave && (
        <svg
          aria-hidden
          viewBox="0 0 390 48"
          preserveAspectRatio="none"
          height="48"
          className="absolute inset-x-0 bottom-0 w-full"
        >
          <path
            d="M0 48 V22 C80 -6 150 -6 200 16 C250 38 320 38 390 12 V48 Z"
            style={{ fill: "var(--background)" }}
          />
        </svg>
      )}
    </div>
  );
}

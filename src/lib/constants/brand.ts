/**
 * Brand color in sRGB hex. Used by `<meta name="theme-color">` (browser
 * chrome) and the global-error fallback page (which can't reach CSS theme
 * tokens because it renders outside the providers).
 *
 * Approximation of `--primary: oklch(0.52 0.14 155)` (defined in
 * `src/app/globals.css`). Keep these two in rough visual sync — the CSS
 * var is the source of truth for the running app; this hex is the
 * fallback for surfaces that can't use it.
 */
export const BRAND_THEME_COLOR_HEX = "#16a34a";

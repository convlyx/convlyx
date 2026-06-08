import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./src/lib/i18n.ts");

// Content Security Policy — first-pass baseline. Locks down what the browser
// will fetch, post forms to, and frame us inside.
//
// Caveat: `'unsafe-inline'` and `'unsafe-eval'` stay in script-src because
// Next.js (app router + RSC hydration) injects inline `<script>` tags and
// some tooling evals. Tightening this further requires per-request nonces
// in middleware — separate refactor.
//
// The valuable wins from this v1 are:
//   - frame-ancestors 'none'  → no clickjacking, replaces X-Frame-Options
//   - connect-src allowlist   → blocks data exfiltration to unknown hosts
//   - form-action 'self'      → no posting forms to attacker domains
//   - object-src 'none'       → no Flash/Java/PDF plugin embeds
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.vercel-insights.com https://*.i.posthog.com https://*.sentry.io",
  // Sentry session-replay (and similar tooling) spawn workers from blob: URLs.
  // Without an explicit worker-src, the browser falls back to script-src, which
  // doesn't allow blob: — so the worker is blocked. Same-origin + blob only.
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // Supabase REST + Realtime + auth, Vercel analytics, Sentry ingest, PostHog.
  "connect-src 'self' https://*.supabase.co https://*.supabase.com wss://*.supabase.co https://*.vercel-insights.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io https://*.i.posthog.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Hide the dev overlay button (bottom-left "N" with build/route info) so
  // landing-page screenshots taken from the running dev server are clean.
  // No effect on production builds.
  devIndicators: false,
  // The Novidades feed (tRPC) reads Markdown from `content/novidades/` at
  // runtime, so pin that directory into the serverless function bundle — Next's
  // tracer can't see the dynamic fs.readdir. Blog pages are static and unaffected.
  outputFileTracingIncludes: {
    "/api/trpc/[trpc]": ["./content/novidades/**/*"],
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: cspDirectives },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        // Camera allowed for our own origin (in-app QR check-in scanner);
        // microphone + geolocation stay disabled.
        { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
      ],
    },
  ],
};

// Only upload source maps to Sentry on production deploys (skip preview to save build time)
const sentryEnabled = process.env.VERCEL_ENV === "production" && !!process.env.SENTRY_AUTH_TOKEN;

export default withSentryConfig(withNextIntl(nextConfig), {
  silent: !sentryEnabled,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: sentryEnabled ? process.env.SENTRY_AUTH_TOKEN : undefined,
  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,
  sourcemaps: sentryEnabled ? undefined : { disable: true },
});

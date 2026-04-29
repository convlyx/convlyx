import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./src/lib/i18n.ts");

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
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

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [Sentry.replayIntegration()],
    enabled: process.env.NODE_ENV === "production",
    // Non-actionable device/browser camera noise from the in-app QR scanner —
    // thrown asynchronously by the Chromium-on-Android media pipeline; the scan
    // still works, so don't report it.
    ignoreErrors: ["setPhotoOptions failed"],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

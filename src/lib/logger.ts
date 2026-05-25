import * as Sentry from "@sentry/nextjs";

/**
 * Structured logger.
 *
 * `info` / `warn` go to the runtime's console (pretty in dev, JSON in prod
 * so log aggregators like Vercel's runtime logs can parse them).
 *
 * `error` does the same AND captures to Sentry. Pass the underlying error
 * (if any) as `error: e` in the context so Sentry gets the proper stack.
 *
 * Levels intentionally don't map 1:1 to `console.*` — `console.error` was
 * being used for both alert-worthy failures and benign-but-noted issues.
 * Use `logger.warn` when you want a log but no Sentry page; reserve
 * `logger.error` for things you'd want an email about.
 */

type Context = Record<string, unknown>;
type ErrorContext = Context & { error?: unknown };

const isDev = process.env.NODE_ENV !== "production";

function emit(level: "info" | "warn" | "error", message: string, context?: Context) {
  if (isDev) {
    const target = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    target(`[${level.toUpperCase()}] ${message}`, context ?? "");
    return;
  }
  const line = JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info(message: string, context?: Context) {
    emit("info", message, context);
  },
  warn(message: string, context?: Context) {
    emit("warn", message, context);
  },
  error(message: string, context?: ErrorContext) {
    emit("error", message, context);
    const err = context?.error;
    if (err instanceof Error) {
      Sentry.captureException(err, { extra: context });
    } else {
      Sentry.captureMessage(message, { level: "error", extra: context });
    }
  },
};

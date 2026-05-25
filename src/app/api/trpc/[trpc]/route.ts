import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import * as Sentry from "@sentry/nextjs";
import { appRouter } from "@/server/routers/_app";
import { createTRPCContext } from "@/server/trpc";
import { isSameOrigin } from "@/lib/csrf";
import { logger } from "@/lib/logger";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
    // Caught TRPCErrors never reach Sentry's `captureRequestError` hook —
    // forward them explicitly, and always log so failures are visible in
    // Vercel function logs (which only see 200s otherwise).
    onError: ({ path, error, type, input }) => {
      // Structured log line — logger.warn (not error) so we don't double-
      // report to Sentry; the explicit captureException below carries the
      // richer tagging.
      logger.warn("trpc procedure failed", {
        type,
        path: path ?? "<no-path>",
        code: error.code,
        message: error.message,
        cause: error.cause,
      });
      Sentry.captureException(error, {
        tags: { trpc_path: path ?? "unknown", trpc_type: type, trpc_code: error.code },
        extra: { input },
      });
    },
    // The fetch adapter defaults to HTTP 200 even for failures — map the
    // worst TRPCError in the batch to a real HTTP status so Vercel logs,
    // monitoring, and the browser network panel reflect reality.
    responseMeta: ({ errors }) => {
      if (errors.length === 0) return {};
      const worst = errors.reduce(
        (max, e) => Math.max(max, getHTTPStatusCodeFromError(e)),
        0,
      );
      return { status: worst };
    },
  });

// Mutations go through POST. Refuse them unless the request came from our
// own UI — defence-in-depth on top of Supabase's SameSite=Lax auth cookies.
//
// On rejection we return a tRPC-shaped error envelope (rather than a bare
// `{error:"Forbidden"}`) so the client's `useTranslatedError` shows a real
// toast (`errors.unexpected`) instead of the cryptic transformer error that
// surfaces when superjson can't parse the response body.
const postHandler = (req: Request) => {
  if (!isSameOrigin(req.headers)) {
    logger.warn("csrf: rejected POST", {
      url: req.url,
      origin: req.headers.get("origin"),
      host: req.headers.get("host"),
      xForwardedHost: req.headers.get("x-forwarded-host"),
      referer: req.headers.get("referer"),
      userAgent: req.headers.get("user-agent"),
    });
    // tRPC batch responses are arrays of result envelopes — return a single-
    // entry array with a FORBIDDEN error so superjson can deserialize it.
    const body = [
      {
        error: {
          json: {
            message: "errors.unexpected",
            code: -32603,
            data: { code: "FORBIDDEN", httpStatus: 403 },
          },
        },
      },
    ];
    return new Response(JSON.stringify(body), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return handler(req);
};

export { handler as GET, postHandler as POST };

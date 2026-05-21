import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import * as Sentry from "@sentry/nextjs";
import { appRouter } from "@/server/routers/_app";
import { createTRPCContext } from "@/server/trpc";
import { isSameOrigin } from "@/lib/csrf";

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
      console.error(
        `[trpc] ${type} ${path ?? "<no-path>"} ${error.code}: ${error.message}`,
        error.cause ?? "",
      );
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
const postHandler = (req: Request) => {
  if (!isSameOrigin(req.headers)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return handler(req);
};

export { handler as GET, postHandler as POST };

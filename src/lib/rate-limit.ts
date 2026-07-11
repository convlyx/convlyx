/**
 * Rate limiter with two backends, chosen at runtime:
 *
 *  - **Distributed (Upstash Redis)** when `UPSTASH_REDIS_REST_URL` +
 *    `UPSTASH_REDIS_REST_TOKEN` are set — limits hold ACROSS all Vercel
 *    function instances. Provision via Vercel Marketplace → Upstash Redis
 *    (it injects those env vars).
 *  - **In-memory fallback** otherwise (local dev, CI, or before provisioning) —
 *    per-instance only, but keeps the app working with no external dependency.
 *
 * `rateLimit` is async (Upstash's API is async); the fallback resolves
 * synchronously. Same `{ success, remaining }` shape either way.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ── In-memory fallback (per-instance sliding window) ───────────────────────
const store = new Map<string, { count: number; resetAt: number }>();

// Cleanup stale entries periodically (fallback path only).
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of store) {
    if (now > value.resetAt) store.delete(key);
  }
}, 60000);

function inMemoryLimit(key: string, limit: number, windowMs: number): { success: boolean; remaining: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }
  if (entry.count >= limit) {
    return { success: false, remaining: 0 };
  }
  entry.count++;
  return { success: true, remaining: limit - entry.count };
}

// ── Distributed (Upstash) ──────────────────────────────────────────────────
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

// One Ratelimit instance per (limit, windowSeconds) config, memoized — so each
// endpoint's own limit/window is honored.
const limiters = new Map<string, Ratelimit>();
function getLimiter(limit: number, windowSeconds: number): Ratelimit {
  const cfgKey = `${limit}:${windowSeconds}`;
  let rl = limiters.get(cfgKey);
  if (!rl) {
    rl = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      prefix: "rl",
    });
    limiters.set(cfgKey, rl);
  }
  return rl;
}

// ── Public API ─────────────────────────────────────────────────────────────
export async function rateLimit({
  key,
  limit = 10,
  windowMs = 60000,
}: {
  key: string;
  limit?: number;
  windowMs?: number;
}): Promise<{ success: boolean; remaining: number }> {
  if (redis) {
    try {
      const windowSeconds = Math.max(1, Math.round(windowMs / 1000));
      const res = await getLimiter(limit, windowSeconds).limit(key);
      return { success: res.success, remaining: res.remaining };
    } catch {
      // Redis unreachable — fail over to in-memory rather than blocking legit
      // traffic on a transient blip. (Per-instance limiting is better than none.)
      return inMemoryLimit(key, limit, windowMs);
    }
  }
  return inMemoryLimit(key, limit, windowMs);
}

/**
 * Get the client IP from request headers (Vercel/Cloudflare).
 */
export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/**
 * Simple in-memory rate limiter for serverless.
 * Uses a sliding window approach per IP.
 * Note: on Vercel, each function instance has its own memory,
 * so this limits per-instance. For production scale, use Upstash Redis.
 */

const store = new Map<string, { count: number; resetAt: number }>();

// Cleanup stale entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of store) {
    if (now > value.resetAt) store.delete(key);
  }
}, 60000);

export function rateLimit({
  key,
  limit = 10,
  windowMs = 60000,
}: {
  key: string;
  limit?: number;
  windowMs?: number;
}): { success: boolean; remaining: number } {
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

/**
 * Get the client IP from request headers (Vercel/Cloudflare)
 */
export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

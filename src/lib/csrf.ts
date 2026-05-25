/**
 * Same-origin check for state-changing requests. Belt-and-braces on top of
 * Supabase Auth's SameSite=Lax cookies — between the two, a malicious
 * third-party page can't forge an authenticated POST to our API.
 *
 * Browsers attach `Origin` to all cross-origin POST/fetch and to same-origin
 * POSTs as well (since the Fetch Living Standard). Compare against the
 * user-facing host to confirm the request came from our own UI.
 *
 * Behind Vercel/Cloudflare, the raw `host` header can be an internal routing
 * hostname (varies by HTTP version and PoP), while the *real* host the
 * browser typed is in `x-forwarded-host`. Prefer the forwarded header — the
 * Next.js middleware uses the same precedence for tenant resolution.
 *
 * Returns `true` when the origin matches the host (or, in a few legitimate
 * cases below, when the request demonstrably isn't a browser at all).
 */
export function isSameOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  const host = headers.get("x-forwarded-host") ?? headers.get("host");

  if (!host) return false; // No host header — bail.

  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  // No Origin header. Browsers always send it on cross-origin and on
  // same-origin POSTs (since 2020-era specs), so absence is suspicious for
  // a state-changing request. Reject.
  return false;
}

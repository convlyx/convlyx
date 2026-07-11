/**
 * Extract the tenant subdomain from a request host.
 *
 * The subdomain is the single source of truth for "which school's site is
 * this" — tenant resolution keys off it (see createTRPCContext, dashboard-user,
 * verify-school). One implementation, used everywhere, so the rules can't drift
 * between the middleware, the login form, and the server.
 *
 * Rules:
 *  - Strips a port (`demo.convlyx.com:443` → `demo.convlyx.com`).
 *  - Local dev: `demo.localhost` → `demo`; bare `localhost` / `127.0.0.1` → null.
 *  - Vercel previews (`*.vercel.app`) → null (they don't match the tenant
 *    pattern; the app isn't tenant-resolvable there).
 *  - Production: `demo.convlyx.com` → `demo` (≥ 3 labels → first label).
 *  - Anything else (apex `convlyx.com`, IPs) → null.
 *
 * Reserved labels (`admin`, `www`, `api`) are returned as-is; callers decide
 * what to do with them (they never resolve to a real School row).
 */
export function extractSubdomain(host: string | null | undefined): string | null {
  if (!host) return null;

  const hostname = host.split(":")[0]!.toLowerCase();

  if (hostname.endsWith(".vercel.app")) return null;
  if (hostname === "localhost" || hostname === "127.0.0.1") return null;

  if (hostname.endsWith(".localhost")) {
    const label = hostname.slice(0, -".localhost".length);
    if (!label) return null;
    return label.split(".")[0]!;
  }

  const parts = hostname.split(".");
  if (parts.length >= 3) return parts[0]!;

  return null;
}

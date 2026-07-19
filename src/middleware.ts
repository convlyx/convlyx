import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { extractSubdomain } from "@/lib/subdomain";

const publicPaths = ["/login", "/register", "/reset-password", "/update-password", "/install"];

// Root domains that should not serve the app (no subdomain)
const ROOT_DOMAINS = ["convlyx.com"];

// Reserved subdomains that are not real schools
const RESERVED_SUBDOMAINS = ["admin", "www", "api"];

// Public marketing/SEO/legal/blog pages that live ONLY on the root domain.
// Single source of truth: the root domain serves them, and a tenant subdomain
// asking for one is 308-redirected to the canonical root URL (so they never
// appear under a tenant host, which would break footer links + duplicate SEO).
const MARKETING_EXACT_PATHS = [
  "/software-escola-conducao",
  "/calendario-aulas-conducao",
  "/gestao-alunos-conducao",
  "/politica-de-privacidade",
  "/termos-e-condicoes",
  "/politica-de-cookies",
  "/contrato-de-subcontratacao",
];
function isMarketingPath(pathname: string): boolean {
  return (
    MARKETING_EXACT_PATHS.includes(pathname) ||
    pathname === "/novidades" ||
    pathname.startsWith("/novidades/") ||
    pathname === "/blog" ||
    pathname.startsWith("/blog/")
  );
}

// Common bot scan paths (WordPress, .env, php-myadmin, etc.) — return 404 fast
const BOT_PATH_PATTERNS = [
  /^\/wp-/i,
  /^\/wordpress/i,
  /^\/xmlrpc\.php/i,
  /^\/phpmyadmin/i,
  /^\/\.env/i,
  /^\/\.git/i,
  /^\/\.aws/i,
  /\.php$/i,
  /\.asp$/i,
  /\.jsp$/i,
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";

  // Block obvious bot scan paths immediately (before any auth/db work)
  if (BOT_PATH_PATTERNS.some((p) => p.test(pathname))) {
    return new NextResponse(null, { status: 404 });
  }

  // Defence in depth: Cloudflare already 301s www → apex at the edge, but if
  // traffic ever bypasses the proxy (DNS-only toggle, direct-to-origin hit)
  // we still avoid serving duplicate content under www. 308 preserves method.
  if (hostname.startsWith("www.")) {
    const apexHost = hostname.slice(4);
    const target = `https://${apexHost}${pathname}${request.nextUrl.search}`;
    return NextResponse.redirect(target, 308);
  }

  const response = NextResponse.next();

  // 1. Resolve tenant from subdomain
  const subdomain = extractSubdomain(hostname);

  // 2. Root domain — "/" + dedicated SEO landing pages; allow SEO files; 404 otherwise.
  const isRootDomain = ROOT_DOMAINS.some((d) => hostname === d || hostname === `${d}:443`);
  if (isRootDomain) {
    if (pathname.startsWith("/api/")) {
      return response;
    }
    if (pathname === "/") {
      return NextResponse.rewrite(new URL("/no-tenant", request.url));
    }
    // Dedicated SEO landing pages, legal pages, and the Novidades blog —
    // keyword-targeted entry points + compliance + changelog. See
    // isMarketingPath (the same set is redirected off tenant subdomains below).
    if (isMarketingPath(pathname)) {
      return response;
    }
    // Allow SEO/PWA files served from public/ and Next.js internals
    const ALLOWED = ["/robots.txt", "/sitemap.xml", "/favicon", "/manifest.json", "/sw.js", "/og-image", "/llms.txt", "/screenshots/"];
    if (ALLOWED.some((p) => pathname.startsWith(p)) || pathname.startsWith("/_next/")) {
      return response;
    }
    return new NextResponse(null, { status: 404 });
  }

  // 3. Platform admin subdomain — rewrite to /platform-admin routes
  if (subdomain === "admin") {
    if (!pathname.startsWith("/platform-admin") && !pathname.startsWith("/login") && !pathname.startsWith("/api/")) {
      return NextResponse.rewrite(new URL(`/platform-admin${pathname === "/" ? "" : pathname}`, request.url));
    }
  }

  // Marketing/SEO/legal/blog pages live only on the root domain. A tenant
  // subdomain asking for one (bookmark, shared link, crawler) is sent to the
  // canonical root URL — prevents broken footer links and duplicate content.
  // Runs before auth so logged-out visitors redirect too. 308 keeps the method
  // and is cacheable. (localhost dev resolves subdomain to null, so this never
  // fires there.)
  if (
    subdomain &&
    !RESERVED_SUBDOMAINS.includes(subdomain) &&
    isMarketingPath(pathname)
  ) {
    const rootHost = hostname.split(".").slice(1).join(".");
    return NextResponse.redirect(
      `https://${rootHost}${pathname}${request.nextUrl.search}`,
      308
    );
  }

  if (subdomain && !RESERVED_SUBDOMAINS.includes(subdomain)) {
    response.headers.set("x-tenant-subdomain", subdomain);
  }

  // 3. Refresh Supabase auth session
  const { user } = await updateSession(request, response);

  // 4. Route protection
  const isPublicPath = publicPaths.some((p) => pathname.startsWith(p));
  // Paths that are always public, even for logged-in users
  const isAlwaysPublic = pathname.startsWith("/install") || pathname.startsWith("/update-password");

  if (!user && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    // Preserve the query string too (e.g. the QR check-in token ?t=…) so the
    // deep link survives the login bounce.
    loginUrl.searchParams.set("redirectTo", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isPublicPath && !isAlwaysPublic) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|favicon\\.png|icon\\.png|apple-icon\\.png|sw\\.js|manifest\\.json|api/).*)",
  ],
};

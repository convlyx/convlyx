import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const publicPaths = ["/login", "/register", "/reset-password", "/update-password"];

// Root domains that should not serve the app (no subdomain)
const ROOT_DOMAINS = ["convlyx.com", "www.convlyx.com"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const response = NextResponse.next();

  // 1. Resolve tenant from subdomain
  const subdomain = extractSubdomain(hostname);

  // 2. Block root domain — app requires a subdomain in production
  const isRootDomain = ROOT_DOMAINS.some((d) => hostname === d || hostname === `${d}:443`);
  if (isRootDomain && !pathname.startsWith("/api/")) {
    // Rewrite to a landing/no-tenant page
    return NextResponse.rewrite(new URL("/no-tenant", request.url));
  }

  if (subdomain) {
    response.headers.set("x-tenant-subdomain", subdomain);
  }

  // 3. Refresh Supabase auth session
  const { user } = await updateSession(request, response);

  // 4. Route protection
  const isPublicPath = publicPaths.some((p) => pathname.startsWith(p));

  if (!user && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isPublicPath) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

function extractSubdomain(hostname: string): string | null {
  if (hostname.startsWith("localhost") || hostname.startsWith("127.0.0.1")) {
    return null;
  }

  const parts = hostname.split(".");
  if (parts.length >= 3) {
    return parts[0];
  }

  return null;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|favicon\\.png|icon\\.png|apple-icon\\.png|api/).*)",
  ],
};

import { redirect } from "next/navigation";
import type { createClient } from "@/lib/supabase/server";

/** Parse the PLATFORM_ADMIN_EMAILS env var into a normalized allowlist. */
export function parsePlatformAdminEmails(raw = process.env.PLATFORM_ADMIN_EMAILS): string[] {
  return (raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Is this email on the platform-admin allowlist? Case-insensitive. */
export function isPlatformAdmin(
  email: string | null | undefined,
  raw?: string,
): boolean {
  if (!email) return false;
  return parsePlatformAdminEmails(raw).includes(email.toLowerCase());
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Server-Component/route guard: returns the authenticated platform-admin's
 * email, or performs the redirect side effect and never returns. Signs the
 * user out if they're logged in but not an operator (prevents a confusing
 * "logged in but bounced" loop).
 */
export async function requirePlatformAdmin(supabase: SupabaseServerClient): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isPlatformAdmin(user.email)) {
    await supabase.auth.signOut();
    redirect("/login");
  }
  return user.email!.toLowerCase();
}

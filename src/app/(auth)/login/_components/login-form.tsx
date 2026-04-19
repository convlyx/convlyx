"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(t("invalidCredentials"));
      toast.error(t("invalidCredentials"));
      setLoading(false);
      return;
    }

    // Validate user belongs to this tenant (if on a subdomain)
    const hostname = window.location.hostname;
    const parts = hostname.split(".");
    const subdomain = parts.length >= 3 ? parts[0] : null;

    if (subdomain && data.user) {
      try {
        const res = await fetch(`/api/trpc/user.me?batch=1&input=${encodeURIComponent('{"0":{"json":null}}')}`);
        const json = await res.json();
        // If tRPC returns an error (UNAUTHORIZED), the user doesn't belong to this tenant
        if (json?.[0]?.error || !json?.[0]?.result?.data) {
          await supabase.auth.signOut();
          setError(t("invalidCredentials"));
          toast.error(t("invalidCredentials"));
          setLoading(false);
          return;
        }
      } catch {
        // If check fails, let the server-side validation handle it
      }
    }

    window.location.href = redirectTo;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          {t("email")}
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="email@exemplo.pt"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-sm font-medium">
            {t("password")}
          </label>
          <Link
            href="/reset-password"
            className="text-xs text-primary hover:underline"
          >
            {t("forgotPassword")}
          </Link>
        </div>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "..." : t("login")}
      </Button>
    </form>
  );
}

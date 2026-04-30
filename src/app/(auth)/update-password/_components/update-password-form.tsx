"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useTranslatedError } from "@/hooks/use-translated-error";

export function UpdatePasswordForm() {
  const t = useTranslations("auth");
  const { onError } = useTranslatedError();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // On mount, establish a session from whichever invite/recovery shape the URL carries:
  //   - OTP token:      ?token_hash=...&type=recovery   (cross-browser safe — preferred)
  //   - Implicit flow:  #access_token=...&refresh_token=...   (cross-browser safe)
  //   - PKCE flow:      ?code=...                             (only redeemable in the
  //                                                            originating browser)
  // We sign out any existing session before applying new tokens so the recovery link
  // can't be silently consumed against the wrong user.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const url = new URL(window.location.href);
      const tokenHash = url.searchParams.get("token_hash");
      const otpType = url.searchParams.get("type");
      const code = url.searchParams.get("code");
      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      const hasIncomingTokens = tokenHash || code || (accessToken && refreshToken);
      if (hasIncomingTokens) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await supabase.auth.signOut();
        }
      }

      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: (otpType as "recovery" | "invite" | "email") ?? "recovery",
        });
        if (cancelled) return;
        if (error) {
          toast.error(t("invalidLink"));
          return;
        }
        window.history.replaceState(null, "", window.location.pathname);
        setSessionReady(true);
        return;
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (cancelled) return;
        if (error) {
          toast.error(t("invalidLink"));
          return;
        }
        window.history.replaceState(null, "", window.location.pathname);
        setSessionReady(true);
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (error) {
          toast.error(t("invalidLink"));
          return;
        }
        window.history.replaceState(null, "", window.location.pathname);
        setSessionReady(true);
        return;
      }

      // No incoming tokens — page reached directly (e.g. user changing password while
      // already logged in). Allow submit only if there's an active session.
      const { data } = await supabase.auth.getSession();
      if (!cancelled) setSessionReady(!!data.session);
    })();

    return () => {
      cancelled = true;
    };
  }, [t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error(t("passwordMismatch"));
      return;
    }

    if (password.length < 6) {
      toast.error(t("passwordTooShort"));
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      onError(error);
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
    toast.success(t("passwordUpdatedSuccess"));

    setTimeout(() => {
      router.push("/");
    }, 2000);
  }

  if (done) {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">{t("passwordUpdated")}</p>
          <p className="text-xs text-muted-foreground">
            {t("redirecting")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">{t("newPassword")}</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="pl-9"
            placeholder={t("minChars")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">{t("confirmPassword")}</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="pl-9"
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={loading || !sessionReady}>
        {loading ? t("updating") : t("updatePassword")}
      </Button>
    </form>
  );
}

"use client";

import { createClient } from "@supabase/supabase-js";

/**
 * Plain Supabase client configured with the implicit auth flow.
 *
 * Use this ONLY for triggering password recovery / invite emails. The default
 * `@supabase/ssr` browser client is hardcoded to PKCE, which causes Supabase
 * to issue `pkce_`-prefixed token_hashes that can only be redeemed in the
 * originating browser. Requests sent through this client produce plain OTP
 * tokens that `verifyOtp` can redeem from any browser or PWA context.
 *
 * Do not use this client for sessions — it doesn't share storage with the
 * SSR client used everywhere else in the app.
 */
export function createImplicitClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "implicit",
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}

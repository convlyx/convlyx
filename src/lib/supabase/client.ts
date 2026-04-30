"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Use implicit flow so password-recovery / invite links work when opened
      // in a different browser or PWA context than the one that requested them.
      // PKCE binds the code to a verifier in the originating browser's storage,
      // which breaks the common case of clicking the email link on another device.
      auth: { flowType: "implicit" },
    }
  );
}

"use client";

import { createClient } from "@/lib/supabase/client";

export function AdminLogout() {
  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
    >
      Sair
    </button>
  );
}

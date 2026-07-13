import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/server/lib/platform-admin";
import { AdminLogout } from "./_components/admin-logout";

export default async function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  await requirePlatformAdmin(supabase); // redirects if not an operator

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <img src="/favicon.png" alt="" width={28} height={28} />
            <span className="font-bold">Convlyx Admin</span>
            <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">Platform</span>
          </div>
          <AdminLogout />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}

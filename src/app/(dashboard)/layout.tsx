import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";
import { Sidebar } from "./_components/sidebar";
import { MobileNav } from "./_components/mobile-nav";
import { Header } from "./_components/header";
import { MobileLayout } from "./_components/mobile-layout";
import { PageTitle } from "@/components/page-title";

async function getAuthUser() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return { supabase, user };
  } catch {
    return { supabase: null, user: null };
  }
}

async function getDbUser(authUserId: string) {
  // Retry once on connection failure
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await db.user.findUnique({
        where: { id: authUserId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          tenantId: true,
          schoolId: true,
          tenant: { select: { name: true, subdomain: true } },
          school: { select: { name: true } },
        },
      });
    } catch (error) {
      if (attempt === 0) {
        // Wait briefly and retry
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      console.error("[Dashboard] DB query failed:", error);
      return null;
    }
  }
  return null;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, user: authUser } = await getAuthUser();

  if (!authUser || !supabase) {
    redirect("/login");
  }

  const user = await getDbUser(authUser.id);

  if (!user) {
    redirect("/login");
  }

  // Validate subdomain matches user's tenant
  const headersList = await headers();
  const subdomain = headersList.get("x-tenant-subdomain");
  if (subdomain && user.tenant.subdomain !== subdomain) {
    await supabase.auth.signOut();
    redirect("/login");
  }

  const pageTitle = `${user.tenant.name} | Convlyx`;

  // Student and Instructor get mobile-first layout
  if (user.role === "STUDENT" || user.role === "INSTRUCTOR") {
    return (
      <MobileLayout
        userId={user.id}
        userName={user.name}
        userRole={user.role}
        tenantName={user.tenant.name}
      >
        <PageTitle title={pageTitle} />
        {children}
      </MobileLayout>
    );
  }

  // Admin and Secretary get the backoffice layout
  return (
    <div className="flex h-screen">
      <PageTitle title={pageTitle} />
      <Sidebar userRole={user.role} tenantName={user.tenant.name} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          userId={user.id}
          userName={user.name}
          userRole={user.role}
          userMobileNav={<MobileNav userRole={user.role} tenantName={user.tenant.name} />}
          tenantName={user.tenant.name}
          schoolName={user.school.name}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

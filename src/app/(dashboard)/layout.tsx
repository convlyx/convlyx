import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";
import { Sidebar } from "./_components/sidebar";
import { MobileNav } from "./_components/mobile-nav";
import { Header } from "./_components/header";
import { MobileLayout } from "./_components/mobile-layout";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: authUser.id },
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

  if (!user) {
    redirect("/login");
  }

  // Validate subdomain matches user's tenant
  const headersList = await headers();
  const subdomain = headersList.get("x-tenant-subdomain");
  if (subdomain && user.tenant.subdomain !== subdomain) {
    // User doesn't belong to this tenant — sign them out and redirect
    await supabase.auth.signOut();
    redirect("/login");
  }

  // Student and Instructor get mobile-first layout
  if (user.role === "STUDENT" || user.role === "INSTRUCTOR") {
    return (
      <MobileLayout
        userId={user.id}
        userName={user.name}
        userRole={user.role}
        tenantName={user.tenant.name}
      >
        {children}
      </MobileLayout>
    );
  }

  // Admin and Secretary get the backoffice layout
  return (
    <div className="flex h-screen">
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

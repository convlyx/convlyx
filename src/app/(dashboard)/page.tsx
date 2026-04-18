import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";
import { DashboardView } from "./_components/dashboard-view";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: authUser.id },
    select: { id: true, name: true, role: true, tenantId: true },
  });

  if (!user) redirect("/login");

  return <DashboardView userName={user.name} userRole={user.role} />;
}

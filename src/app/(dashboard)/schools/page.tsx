import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";
import { SchoolsPageClient } from "./_components/schools-page-client";

export default async function SchoolsPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: authUser.id },
    select: { role: true },
  });
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");

  return <SchoolsPageClient />;
}

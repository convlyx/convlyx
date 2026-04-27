import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";
import { ClassesPageClient } from "./_components/classes-page-client";

export default async function ClassesPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: authUser.id },
    select: { role: true },
  });
  if (!user) redirect("/login");

  return <ClassesPageClient userRole={user.role} userId={authUser.id} />;
}

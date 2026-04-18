import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";
import { UsersPageClient } from "./_components/users-page-client";

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: authUser.id },
    select: { role: true },
  });
  if (!user) redirect("/login");
  if (!["ADMIN", "SECRETARY"].includes(user.role)) redirect("/");

  return <UsersPageClient userRole={user.role} />;
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";
import { StudentsPageClient } from "./_components/students-page-client";

export default async function StudentsPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: authUser.id },
    select: { role: true },
  });
  if (!user) redirect("/login");
  if (!["ADMIN", "SECRETARY", "INSTRUCTOR"].includes(user.role)) redirect("/");

  return <StudentsPageClient userRole={user.role} />;
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";
import { InstructorsPageClient } from "./_components/instructors-page-client";

export default async function InstructorsPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: authUser.id },
    select: { role: true },
  });
  if (!user) redirect("/login");
  if (!["ADMIN", "SECRETARY"].includes(user.role)) redirect("/");

  return <InstructorsPageClient userRole={user.role} />;
}

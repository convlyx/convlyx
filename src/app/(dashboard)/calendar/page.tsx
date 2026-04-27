import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";
import { CalendarView } from "./_components/calendar-view";

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: authUser.id },
    select: { role: true },
  });

  if (!user) redirect("/login");

  return <CalendarView userRole={user.role} userId={authUser.id} />;
}

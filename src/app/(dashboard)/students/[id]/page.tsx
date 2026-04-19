import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";
import { StudentDetailPage } from "./_components/student-detail-page";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function StudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!UUID_REGEX.test(id)) notFound();

  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: authUser.id },
    select: { role: true, tenantId: true },
  });
  if (!user) redirect("/login");
  if (!["ADMIN", "SECRETARY", "INSTRUCTOR"].includes(user.role)) redirect("/");

  const studentExists = await db.user.findFirst({
    where: { id, tenantId: user.tenantId, role: "STUDENT" },
    select: { id: true },
  });
  if (!studentExists) notFound();

  return <StudentDetailPage id={id} />;
}

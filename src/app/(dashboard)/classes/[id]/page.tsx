import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";
import { ClassDetailView } from "./_components/class-detail-view";

// UUID regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ClassDetailPage({
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
  if (!["ADMIN", "SECRETARY"].includes(user.role)) redirect("/classes");

  // Verify the class exists in this tenant
  const classExists = await db.classSession.findFirst({
    where: { id, tenantId: user.tenantId },
    select: { id: true },
  });
  if (!classExists) notFound();

  return <ClassDetailView classId={id} userRole={user.role} />;
}

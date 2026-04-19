import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";
import { InstructorDetailPage } from "./_components/instructor-detail-page";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function InstructorPage({
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
  if (!["ADMIN", "SECRETARY"].includes(user.role)) redirect("/");

  const instructorExists = await db.user.findFirst({
    where: { id, tenantId: user.tenantId, role: "INSTRUCTOR" },
    select: { id: true },
  });
  if (!instructorExists) notFound();

  return <InstructorDetailPage id={id} />;
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";
import { SettingsForm } from "./_components/settings-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      school: { select: { id: true, name: true, address: true, phone: true } },
      tenant: { select: { id: true, name: true } },
    },
  });

  if (!user) redirect("/login");

  return (
    <SettingsForm
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      }}
      school={{
        id: user.school.id,
        name: user.school.name,
        address: user.school.address ?? "",
        phone: user.school.phone ?? "",
      }}
      tenant={{
        id: user.tenant.id,
        name: user.tenant.name,
      }}
    />
  );
}

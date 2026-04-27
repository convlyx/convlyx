import { headers } from "next/headers";
import { db } from "@/server/db";
import { InstallView } from "./_components/install-view";

export default async function InstallPage() {
  const headersList = await headers();
  const subdomain = headersList.get("x-tenant-subdomain");

  let schoolName: string | null = null;
  if (subdomain) {
    const school = await db.school.findUnique({
      where: { subdomain },
      select: { name: true },
    });
    schoolName = school?.name ?? null;
  }

  return <InstallView schoolName={schoolName} />;
}

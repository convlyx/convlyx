"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/generated/prisma/enums";

type HeaderProps = {
  userName: string;
  userRole: UserRole;
  tenantName: string;
  schoolName: string;
};

export function Header({
  userName,
  userRole,
  tenantName,
  schoolName,
}: HeaderProps) {
  const t = useTranslations();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 items-center justify-between border-b px-6">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {tenantName} — {schoolName}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium">{userName}</p>
          <p className="text-xs text-muted-foreground">
            {t(`roles.${userRole}`)}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          {t("auth.logout")}
        </Button>
      </div>
    </header>
  );
}

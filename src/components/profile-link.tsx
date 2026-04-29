"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { UserRole } from "@/generated/prisma/enums";

type ProfileType = "student" | "instructor";

/**
 * Roles that can navigate to each profile page.
 * Mirrors the server-side checks in the corresponding `[id]/page.tsx`.
 */
const ACCESS: Record<ProfileType, UserRole[]> = {
  student: ["ADMIN", "SECRETARY", "INSTRUCTOR"],
  instructor: ["ADMIN", "SECRETARY"],
};

type Props = {
  type: ProfileType;
  id: string;
  name: string;
  userRole: UserRole;
  /** Called on navigation — typically used to close a parent dialog/popup */
  onNavigate?: () => void;
};

/**
 * Renders a name as a link to the relevant profile page when the current user
 * has access; otherwise renders plain text.
 */
export function ProfileLink({ type, id, name, userRole, onNavigate }: Props) {
  const canView = ACCESS[type].includes(userRole);

  if (!canView) {
    return <span>{name}</span>;
  }

  return (
    <Link
      href={`/${type}s/${id}`}
      className="text-primary hover:underline inline-flex items-center gap-1"
      onClick={onNavigate}
    >
      {name}
      <ExternalLink className="h-3 w-3" />
    </Link>
  );
}

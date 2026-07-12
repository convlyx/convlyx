/**
 * Per-tenant name resolution for user relations.
 *
 * Name is per-tenant (on Membership), but people are still referenced through
 * User relations (a class's instructor, an enrollment's student, …). To show
 * the name THIS tenant uses, select the user's membership in the current tenant
 * alongside the global User.name, then resolve with `tenantName`.
 *
 * Usage in a Prisma select:
 *   instructor: { select: { id: true, ...userNameSelect(ctx.tenantId) } }
 * then when shaping the result:
 *   name: tenantName(row.instructor)
 */
export function userNameSelect(tenantId: string) {
  return {
    name: true,
    memberships: { where: { tenantId }, select: { name: true }, take: 1 },
  } as const;
}

type WithMembershipName = {
  name: string;
  memberships: { name: string }[];
};

/**
 * The name to display for a user in the current tenant: their membership name
 * here, falling back to the global User.name when they have no membership in
 * this tenant (e.g. an instructor who has since left but still appears on a
 * historical class/exam).
 */
export function tenantName(u: WithMembershipName | null | undefined): string {
  if (!u) return "";
  return u.memberships[0]?.name ?? u.name;
}

-- Cross-tenant identity, final step: the per-tenant facts now live entirely on
-- Membership, so the vestigial columns on `users` are dropped and email becomes
-- globally unique (one login identity across the whole platform).
--
-- Nothing reads these columns anymore (verified across the app). Membership
-- carries role/school/status/name/phone/qualifications/novidades-seen; email +
-- name + phone remain on User as the global identity (name/phone are the
-- display fallback).

-- Drop FKs + indexes that depend on the columns being removed.
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_tenant_id_fkey";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_school_id_fkey";
DROP INDEX IF EXISTS "users_tenant_id_idx";
DROP INDEX IF EXISTS "users_school_id_idx";
-- The old composite unique (tenant_id, email) goes away with tenant_id.
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_tenant_id_email_key";

ALTER TABLE "users" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "users" DROP COLUMN IF EXISTS "school_id";
ALTER TABLE "users" DROP COLUMN IF EXISTS "role";
ALTER TABLE "users" DROP COLUMN IF EXISTS "status";
ALTER TABLE "users" DROP COLUMN IF EXISTS "qualified_categories";
ALTER TABLE "users" DROP COLUMN IF EXISTS "novidades_seen_at";

-- Email is now unique across the platform (safe: one Supabase auth user maps
-- to exactly one User row, so no cross-tenant duplicates exist).
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "qualified_categories" "LicenseCategory"[] DEFAULT ARRAY[]::"LicenseCategory"[],
    "novidades_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "memberships_tenant_id_user_id_key" ON "memberships"("tenant_id", "user_id");
CREATE INDEX "memberships_tenant_id_idx" ON "memberships"("tenant_id");
CREATE INDEX "memberships_school_id_idx" ON "memberships"("school_id");
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: one membership per existing user (mirrors their current tenant/school/role).
INSERT INTO "memberships" (id, tenant_id, user_id, school_id, role, status, qualified_categories, novidades_seen_at, created_at, updated_at)
SELECT gen_random_uuid(), tenant_id, id, school_id, role, status, qualified_categories, novidades_seen_at, now(), now()
FROM "users";

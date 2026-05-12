-- Add tenant_id to push_subscriptions so push sends can scope by tenant.
-- Done in three steps so existing rows don't violate NOT NULL during ADD COLUMN.

-- 1. Add as nullable
ALTER TABLE "push_subscriptions" ADD COLUMN "tenant_id" UUID;

-- 2. Backfill from the owning user
UPDATE "push_subscriptions" ps
SET "tenant_id" = u."tenant_id"
FROM "users" u
WHERE ps."user_id" = u."id";

-- 3. Lock it down
ALTER TABLE "push_subscriptions" ALTER COLUMN "tenant_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "push_subscriptions_tenant_id_idx" ON "push_subscriptions"("tenant_id");

-- Coarse activity signal for the internal admin console (WAU / last-active).
-- Nullable; populated going forward by a throttled heartbeat write. The
-- composite index backs per-tenant "active in the last N days" range scans.

ALTER TABLE "memberships" ADD COLUMN "last_seen_at" TIMESTAMP(3);

CREATE INDEX "memberships_tenant_id_last_seen_at_idx" ON "memberships"("tenant_id", "last_seen_at");

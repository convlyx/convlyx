-- Composite tenant+time indexes for the hot class list/analytics range scans.
-- class.list's upcoming/past tabs and status filters key off the clock (status
-- is derived, not stored — see effectiveClassStatus), so they range-scan
-- starts_at / ends_at within a tenant; analytics.attendanceTrend filters
-- ends_at. class_sessions only had a single-column starts_at index and no
-- ends_at index. Plain CREATE INDEX — the table is small enough that the brief
-- write lock is fine; switch to CONCURRENTLY if it grows large.
CREATE INDEX "class_sessions_tenant_id_starts_at_idx" ON "class_sessions"("tenant_id", "starts_at");
CREATE INDEX "class_sessions_tenant_id_ends_at_idx" ON "class_sessions"("tenant_id", "ends_at");

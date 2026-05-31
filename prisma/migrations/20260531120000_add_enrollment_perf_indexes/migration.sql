-- Composite indexes for the enrollment analytics range scans
-- (enrolments-over-time and the attendance snapshot), which filter by
-- tenant + date (+ status). Plain CREATE INDEX — enrollments is small enough
-- that the brief write lock is fine; switch to CONCURRENTLY if it grows large.
CREATE INDEX "enrollments_tenant_id_enrolled_at_idx" ON "enrollments"("tenant_id", "enrolled_at");
CREATE INDEX "enrollments_tenant_id_status_enrolled_at_idx" ON "enrollments"("tenant_id", "status", "enrolled_at");

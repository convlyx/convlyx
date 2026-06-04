-- Add per-school IANA timezone. Default covers mainland Portugal + Madeira;
-- Azores schools use 'Atlantic/Azores'. Existing rows inherit the default,
-- so behaviour is unchanged for current (Lisbon) schools.
ALTER TABLE "schools" ADD COLUMN "time_zone" TEXT NOT NULL DEFAULT 'Europe/Lisbon';

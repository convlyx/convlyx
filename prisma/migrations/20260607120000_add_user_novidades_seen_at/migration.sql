-- Per-user "last seen" timestamp for the Novidades (What's New) panel.
-- Drives the unread badge: posts newer than this (and matching the user's role)
-- count as unread. Nullable — a NULL means the user has never opened the panel,
-- so every post visible to their role counts as unread.
ALTER TABLE "users" ADD COLUMN "novidades_seen_at" TIMESTAMP(3);

ALTER TABLE "class_sessions" ADD COLUMN "check_in_opened_at" TIMESTAMP(3);
ALTER TABLE "class_sessions" ADD COLUMN "check_in_secret" VARCHAR(64);
ALTER TABLE "enrollments" ADD COLUMN "checked_in_at" TIMESTAMP(3);

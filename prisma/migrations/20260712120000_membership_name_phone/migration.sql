-- Per-tenant identity: name + phone move onto Membership so the same person
-- (one login/email on User) can be labelled differently at each school.
--
-- Added nullable, backfilled from the User row, then name is set NOT NULL
-- (phone stays optional) so existing rows are valid without a default.

ALTER TABLE "memberships" ADD COLUMN "name" TEXT;
ALTER TABLE "memberships" ADD COLUMN "phone" TEXT;

UPDATE "memberships" m
SET "name" = u."name", "phone" = u."phone"
FROM "users" u
WHERE m."user_id" = u."id";

ALTER TABLE "memberships" ALTER COLUMN "name" SET NOT NULL;

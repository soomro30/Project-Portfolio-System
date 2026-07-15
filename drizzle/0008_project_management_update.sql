ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "management_update" text;

UPDATE "projects"
SET "management_update" = "main_blocker_risk"
WHERE "management_update" IS NULL
  AND "main_blocker_risk" IS NOT NULL;

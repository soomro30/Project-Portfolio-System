ALTER TABLE "weekly_updates"
  ADD COLUMN IF NOT EXISTS "progress_percent" integer,
  ADD COLUMN IF NOT EXISTS "management_update" text;

CREATE UNIQUE INDEX IF NOT EXISTS "weekly_updates_project_date_idx"
  ON "weekly_updates" ("project_id", "update_date");

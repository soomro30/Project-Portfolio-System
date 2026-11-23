CREATE INDEX IF NOT EXISTS "project_milestones_project_sort_idx" ON "project_milestones" ("project_id", "sort_order", "due_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_milestones_open_due_idx" ON "project_milestones" ("due_date", "project_id") WHERE "status" <> 'completed';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_risks_project_sort_idx" ON "project_risks" ("project_id", "sort_order", "target_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_email_recipients_project_idx" ON "project_email_recipients" ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_runs_project_created_idx" ON "email_runs" ("project_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_runs_project_sent_idx" ON "email_runs" ("project_id", "sent_at" DESC) WHERE "status" = 'sent';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_expiry_idx" ON "password_reset_tokens" ("user_id", "expires_at");

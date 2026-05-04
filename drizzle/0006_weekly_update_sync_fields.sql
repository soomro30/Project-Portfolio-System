ALTER TABLE "weekly_updates" ADD COLUMN "pending_with" varchar(255);--> statement-breakpoint
ALTER TABLE "weekly_updates" ADD COLUMN "next_milestone" text;--> statement-breakpoint
ALTER TABLE "weekly_updates" ADD COLUMN "next_milestone_date" date;

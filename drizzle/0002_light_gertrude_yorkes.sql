ALTER TABLE "projects" ADD COLUMN "actual_end_date" date;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "budget_currency" varchar(8);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "contract_value" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "actual_spend_to_date" numeric(14, 2);
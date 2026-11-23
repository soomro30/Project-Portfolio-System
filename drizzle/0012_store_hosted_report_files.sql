CREATE TABLE "report_files" (
	"run_id" varchar(64) NOT NULL,
	"filename" varchar(255) NOT NULL,
	"content" "bytea" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "report_files_run_id_filename_pk" PRIMARY KEY("run_id","filename")
);
--> statement-breakpoint
ALTER TABLE "report_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "report_files_expiry_idx" ON "report_files" USING btree ("expires_at");
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'portfolio_runtime') THEN
    GRANT SELECT, INSERT, DELETE ON TABLE public.report_files TO portfolio_runtime;
    CREATE POLICY portfolio_runtime_select ON public.report_files FOR SELECT TO portfolio_runtime USING (true);
    CREATE POLICY portfolio_runtime_insert ON public.report_files FOR INSERT TO portfolio_runtime WITH CHECK (true);
    CREATE POLICY portfolio_runtime_delete ON public.report_files FOR DELETE TO portfolio_runtime USING (true);
  END IF;
END
$$;

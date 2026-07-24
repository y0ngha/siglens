CREATE TABLE "seo_analysis_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"tab" varchar(16) NOT NULL,
	"content" jsonb NOT NULL,
	"model" varchar(64) NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "seo_analysis_snapshots_symbol_tab_uq" ON "seo_analysis_snapshots" USING btree ("symbol","tab");--> statement-breakpoint
CREATE INDEX "seo_analysis_snapshots_symbol_idx" ON "seo_analysis_snapshots" USING btree ("symbol");
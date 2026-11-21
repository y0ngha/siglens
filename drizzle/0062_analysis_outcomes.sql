CREATE TABLE "analysis_outcomes" (
	"analysis_id" uuid PRIMARY KEY NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"timeframe" varchar(8) NOT NULL,
	"model_id" varchar(64) NOT NULL,
	"tier" varchar(16),
	"prompt_version" varchar(32),
	"locale" "content_locale" NOT NULL,
	"input_fingerprint" varchar(32),
	"generated_at" timestamp with time zone NOT NULL,
	"anchor_close_basis" varchar(24),
	"subject" jsonb NOT NULL,
	"status" varchar(16) NOT NULL,
	"skip_reason" varchar(32),
	"load_failures" integer DEFAULT 0 NOT NULL,
	"row_errors" integer DEFAULT 0 NOT NULL,
	"anchor_missing_seen" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"forward_have" integer,
	"stalled_since" timestamp with time zone,
	"relabel_failed_version" integer,
	"label_version" integer,
	"labels" jsonb,
	"bars_snapshot" jsonb,
	"labeled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analysis_history" ADD COLUMN "personalized" boolean;--> statement-breakpoint
CREATE INDEX "analysis_outcomes_pending_idx" ON "analysis_outcomes" USING btree ("next_attempt_at") WHERE "analysis_outcomes"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "analysis_outcomes_symbol_tf_idx" ON "analysis_outcomes" USING btree ("symbol","timeframe","generated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "analysis_outcomes_generated_at_idx" ON "analysis_outcomes" USING btree ("generated_at");--> statement-breakpoint
CREATE INDEX "analysis_outcomes_relabel_idx" ON "analysis_outcomes" USING btree ("label_version") WHERE "analysis_outcomes"."status" = 'labeled';--> statement-breakpoint
CREATE INDEX "analysis_history_generated_at_idx" ON "analysis_history" USING btree ("generated_at");
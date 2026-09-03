CREATE TABLE "analysis_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"timeframe" varchar(8) NOT NULL,
	"tab" varchar(16) NOT NULL,
	"model_id" varchar(64) NOT NULL,
	"locale" "content_locale" NOT NULL,
	"result" jsonb NOT NULL,
	"input_fingerprint" varchar(32),
	"prompt_version" varchar(32),
	"prompt_stable_hash" char(64),
	"prompt_system_hash" char(64),
	"prompt_dynamic" text,
	"generated_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analysis_prompt_blobs" (
	"hash" char(64) PRIMARY KEY NOT NULL,
	"body" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "analysis_history_lookup_idx" ON "analysis_history" USING btree ("symbol","timeframe","tab","generated_at" DESC NULLS LAST);
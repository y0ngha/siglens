CREATE TYPE "public"."shareable_kind" AS ENUM('chart', 'overall', 'news', 'fundamental', 'financials', 'congress', 'options', 'fear-greed');--> statement-breakpoint
CREATE TABLE "shared_analyses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"kind" "shareable_kind" NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"snapshot_json" jsonb NOT NULL,
	"sharer_tier" "user_tier" DEFAULT 'free' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shared_analyses" ADD CONSTRAINT "shared_analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shared_analyses_symbol_idx" ON "shared_analyses" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "shared_analyses_expires_at_idx" ON "shared_analyses" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shared_analyses_content_uq" ON "shared_analyses" USING btree ("content_hash");
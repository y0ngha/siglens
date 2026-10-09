CREATE TABLE "funnel_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"visitor_hash" text NOT NULL,
	"user_id" uuid,
	"event" text NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "visitor_days" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "funnel_events_event_time_idx" ON "funnel_events" USING btree ("event","occurred_at");--> statement-breakpoint
CREATE INDEX "funnel_events_user_time_idx" ON "funnel_events" USING btree ("user_id","occurred_at");--> statement-breakpoint
ALTER TABLE "visitor_days" ADD CONSTRAINT "visitor_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visitor_days_user_id_idx" ON "visitor_days" USING btree ("user_id","date");
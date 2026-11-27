CREATE TABLE "email_report_welcomes" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"attempts" smallint DEFAULT 1 NOT NULL,
	"error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_report_welcomes_status_check" CHECK ("email_report_welcomes"."status" IN ('sending','sent','failed'))
);
--> statement-breakpoint
ALTER TABLE "email_report_subscriptions" ADD COLUMN IF NOT EXISTS "consent_source" text;--> statement-breakpoint
UPDATE "email_report_subscriptions" SET "consent_source" = 'settings' WHERE "consented_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "email_report_welcomes" ADD CONSTRAINT "email_report_welcomes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_report_welcomes_created_at_idx" ON "email_report_welcomes" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "email_report_subscriptions" ADD CONSTRAINT "email_report_subscriptions_consent_source_check" CHECK ("email_report_subscriptions"."consent_source" IS NULL OR "email_report_subscriptions"."consent_source" IN ('settings','signup_email','signup_oauth'));
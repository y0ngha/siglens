CREATE TABLE "email_report_subscriptions" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"days_of_week" integer NOT NULL,
	"send_hour" integer NOT NULL,
	"timezone" text NOT NULL,
	"locale" "content_locale" DEFAULT 'ko' NOT NULL,
	"consented_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_report_subscriptions" ADD CONSTRAINT "email_report_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE TABLE "mail_alert_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscriber_id" uuid NOT NULL,
	"alert_date" date NOT NULL,
	"status" text NOT NULL,
	"item_keys" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mail_alert_deliveries_status_check" CHECK ("mail_alert_deliveries"."status" IN ('pending','sent','failed'))
);
--> statement-breakpoint
CREATE TABLE "mail_alert_subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"user_id" uuid,
	"locale" "content_locale" DEFAULT 'ko' NOT NULL,
	"include_portfolio" boolean DEFAULT false NOT NULL,
	"consented_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consent_source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mail_alert_subscribers_email_unique" UNIQUE("email"),
	CONSTRAINT "mail_alert_subscribers_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "mail_alert_subscribers_consent_source_check" CHECK ("mail_alert_subscribers"."consent_source" IN ('symbol','fear_greed','signal_hub','settings'))
);
--> statement-breakpoint
CREATE TABLE "mail_alert_topics" (
	"subscriber_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"key" varchar(48) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mail_alert_topics_subscriber_id_kind_key_pk" PRIMARY KEY("subscriber_id","kind","key"),
	CONSTRAINT "mail_alert_topics_kind_check" CHECK ("mail_alert_topics"."kind" IN ('symbol','signal','fear_greed'))
);
--> statement-breakpoint
ALTER TABLE "mail_alert_deliveries" ADD CONSTRAINT "mail_alert_deliveries_subscriber_id_mail_alert_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."mail_alert_subscribers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_alert_subscribers" ADD CONSTRAINT "mail_alert_subscribers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_alert_topics" ADD CONSTRAINT "mail_alert_topics_subscriber_id_mail_alert_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."mail_alert_subscribers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mail_alert_deliveries_subscriber_date_uidx" ON "mail_alert_deliveries" USING btree ("subscriber_id","alert_date");--> statement-breakpoint
CREATE INDEX "mail_alert_deliveries_alert_date_idx" ON "mail_alert_deliveries" USING btree ("alert_date");--> statement-breakpoint
CREATE INDEX "mail_alert_topics_kind_key_idx" ON "mail_alert_topics" USING btree ("kind","key");
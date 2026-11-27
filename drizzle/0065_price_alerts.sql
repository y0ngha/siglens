CREATE TABLE "price_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscriber_id" uuid NOT NULL,
	"proposal_id" uuid NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"market" text NOT NULL,
	"condition" text NOT NULL,
	"approach" text,
	"zone_low" numeric(20, 6),
	"zone_high" numeric(20, 6),
	"level" numeric(20, 6),
	"basis" text NOT NULL,
	"analysis_at" timestamp with time zone,
	"reference_close" numeric(20, 6) NOT NULL,
	"starts_after_session" date NOT NULL,
	"expires_on" date NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"fired_session" date,
	"fired_close" numeric(20, 6),
	"fired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_alerts_market_check" CHECK ("price_alerts"."market" IN ('us','kr')),
	CONSTRAINT "price_alerts_condition_check" CHECK ("price_alerts"."condition" IN ('enter_zone','close_below','close_above')),
	CONSTRAINT "price_alerts_approach_check" CHECK ("price_alerts"."approach" IN ('from_above','from_below')),
	CONSTRAINT "price_alerts_basis_check" CHECK ("price_alerts"."basis" IN ('analysis_entry_zone','analysis_invalidation','price_level')),
	CONSTRAINT "price_alerts_status_check" CHECK ("price_alerts"."status" IN ('active','fired')),
	CONSTRAINT "price_alerts_shape_check" CHECK (("price_alerts"."condition" = 'enter_zone' AND "price_alerts"."approach" IS NOT NULL AND "price_alerts"."zone_low" IS NOT NULL AND "price_alerts"."zone_high" IS NOT NULL AND "price_alerts"."level" IS NULL AND "price_alerts"."zone_low" > 0 AND "price_alerts"."zone_low" <= "price_alerts"."zone_high") OR ("price_alerts"."condition" IN ('close_below','close_above') AND "price_alerts"."approach" IS NULL AND "price_alerts"."zone_low" IS NULL AND "price_alerts"."zone_high" IS NULL AND "price_alerts"."level" IS NOT NULL AND "price_alerts"."level" > 0)),
	CONSTRAINT "price_alerts_finite_check" CHECK ("price_alerts"."zone_low" <> 'NaN' AND "price_alerts"."zone_high" <> 'NaN' AND "price_alerts"."level" <> 'NaN' AND "price_alerts"."reference_close" <> 'NaN' AND "price_alerts"."fired_close" <> 'NaN'),
	CONSTRAINT "price_alerts_reference_close_check" CHECK ("price_alerts"."reference_close" > 0),
	CONSTRAINT "price_alerts_fired_state_check" CHECK (("price_alerts"."status" = 'active' AND "price_alerts"."fired_session" IS NULL AND "price_alerts"."fired_close" IS NULL AND "price_alerts"."fired_at" IS NULL) OR ("price_alerts"."status" = 'fired' AND "price_alerts"."fired_session" IS NOT NULL AND "price_alerts"."fired_close" IS NOT NULL AND "price_alerts"."fired_at" IS NOT NULL)),
	CONSTRAINT "price_alerts_basis_shape_check" CHECK (("price_alerts"."basis" = 'price_level' AND "price_alerts"."analysis_at" IS NULL) OR ("price_alerts"."basis" = 'analysis_entry_zone' AND "price_alerts"."analysis_at" IS NOT NULL AND "price_alerts"."condition" = 'enter_zone') OR ("price_alerts"."basis" = 'analysis_invalidation' AND "price_alerts"."analysis_at" IS NOT NULL AND "price_alerts"."condition" = 'close_below'))
);
--> statement-breakpoint
ALTER TABLE "mail_alert_subscribers" DROP CONSTRAINT IF EXISTS "mail_alert_subscribers_consent_source_check";--> statement-breakpoint
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_subscriber_id_mail_alert_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."mail_alert_subscribers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "price_alerts_subscriber_proposal_uidx" ON "price_alerts" USING btree ("subscriber_id","proposal_id");--> statement-breakpoint
CREATE INDEX "price_alerts_status_expires_idx" ON "price_alerts" USING btree ("status","expires_on");--> statement-breakpoint
ALTER TABLE "mail_alert_subscribers" ADD CONSTRAINT "mail_alert_subscribers_consent_source_check" CHECK ("mail_alert_subscribers"."consent_source" IN ('symbol','fear_greed','signal_hub','settings','agent_chat'));
CREATE TABLE "economic_calendar" (
	"id" text PRIMARY KEY NOT NULL,
	"country" text NOT NULL,
	"date_et" text NOT NULL,
	"event" text NOT NULL,
	"impact" text NOT NULL,
	"estimate" double precision,
	"previous" double precision,
	"actual" double precision,
	"unit" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "economic_calendar_date_et_idx" ON "economic_calendar" USING btree ("date_et");--> statement-breakpoint
CREATE INDEX "economic_calendar_country_date_et_idx" ON "economic_calendar" USING btree ("country","date_et");--> statement-breakpoint
CREATE INDEX "economic_calendar_impact_idx" ON "economic_calendar" USING btree ("impact");
ALTER TABLE "economic_calendar" ADD COLUMN "sentiment" text;--> statement-breakpoint
ALTER TABLE "economic_calendar" ADD COLUMN "summary_ko" text;--> statement-breakpoint
ALTER TABLE "economic_calendar" ADD COLUMN "interpretation_ko" text;--> statement-breakpoint
ALTER TABLE "economic_calendar" ADD COLUMN "analyzed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "economic_calendar_impact_analyzed_at_idx" ON "economic_calendar" USING btree ("impact","analyzed_at");
ALTER TABLE "analysis_history" ADD COLUMN "tier" varchar(16);--> statement-breakpoint
ALTER TABLE "signal_events" ADD COLUMN "price_at_detection" double precision;
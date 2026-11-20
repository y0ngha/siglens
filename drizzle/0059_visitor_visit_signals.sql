ALTER TABLE "visitor_days" ADD COLUMN "landing_site" text;--> statement-breakpoint
ALTER TABLE "visitor_days" ADD COLUMN "first_visit_bucket" text;--> statement-breakpoint
ALTER TABLE "visitor_days" ADD COLUMN "last_visit_bucket" text;--> statement-breakpoint
ALTER TABLE "visitor_days" ADD COLUMN "visit_days_bucket" text;--> statement-breakpoint
ALTER TABLE "visitor_days" ADD COLUMN "return_window" text;
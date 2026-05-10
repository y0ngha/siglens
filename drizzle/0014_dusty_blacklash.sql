ALTER TABLE "earnings_reports" ADD COLUMN "eps_actual" numeric;--> statement-breakpoint
ALTER TABLE "earnings_reports" ADD COLUMN "eps_estimated" numeric;--> statement-breakpoint
ALTER TABLE "earnings_reports" ADD COLUMN "revenue_actual" numeric;--> statement-breakpoint
ALTER TABLE "earnings_reports" ADD COLUMN "revenue_estimated" numeric;--> statement-breakpoint
ALTER TABLE "earnings_reports" ADD COLUMN "last_updated" date;
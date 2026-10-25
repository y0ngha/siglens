ALTER TABLE "guide_entries" ADD COLUMN "about" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "guide_entries" ADD COLUMN "signals" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "guide_entries" ADD COLUMN "demo_from" text;
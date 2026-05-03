CREATE TABLE "earnings_calendar" (
	"symbol" text NOT NULL,
	"earnings_date" date NOT NULL,
	"eps_actual" numeric,
	"eps_estimated" numeric,
	"revenue_actual" numeric,
	"revenue_estimated" numeric,
	"last_updated" date,
	"raw_payload" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "earnings_calendar_symbol_earnings_date_pk" PRIMARY KEY("symbol","earnings_date")
);
--> statement-breakpoint
CREATE TABLE "earnings_reports" (
	"symbol" text NOT NULL,
	"earnings_date" date NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "earnings_reports_symbol_earnings_date_pk" PRIMARY KEY("symbol","earnings_date")
);
--> statement-breakpoint
CREATE TABLE "inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"email" varchar(320) NOT NULL,
	"answered" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news" (
	"id" text PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"source" text NOT NULL,
	"url" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"title_en" text NOT NULL,
	"title_ko" text,
	"body_en" text,
	"body_ko" text,
	"summary_ko" text,
	"sentiment" text,
	"category" text,
	"raw_payload" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"analyzed_at" timestamp with time zone,
	CONSTRAINT "news_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE INDEX "earnings_calendar_date_idx" ON "earnings_calendar" USING btree ("earnings_date");--> statement-breakpoint
CREATE INDEX "news_symbol_published_at_idx" ON "news" USING btree ("symbol","published_at");--> statement-breakpoint
CREATE INDEX "news_published_at_idx" ON "news" USING btree ("published_at");
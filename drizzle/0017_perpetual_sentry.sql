CREATE TABLE "market_news" (
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
	"price_impact" text,
	"tickers" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"raw_payload" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"analyzed_at" timestamp with time zone,
	CONSTRAINT "market_news_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE INDEX "market_news_symbol_published_at_idx" ON "market_news" USING btree ("symbol","published_at");--> statement-breakpoint
CREATE INDEX "market_news_published_at_idx" ON "market_news" USING btree ("published_at");
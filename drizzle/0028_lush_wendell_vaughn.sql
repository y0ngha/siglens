ALTER TABLE "korean_tickers" ADD COLUMN "delisted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "korean_tickers_delisted_at_idx" ON "korean_tickers" USING btree ("delisted_at");
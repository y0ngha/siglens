CREATE TABLE "cusip_symbol_map" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cusip_symbol_map_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"cusip" char(9) NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"source" varchar(16) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checked_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finra_short_interest" (
	"symbol" varchar(32) NOT NULL,
	"settlement_date" date NOT NULL,
	"short_qty" bigint NOT NULL,
	"prev_short_qty" bigint,
	"avg_daily_volume" bigint,
	"days_to_cover" numeric(10, 2),
	CONSTRAINT "finra_short_interest_symbol_settlement_date_pk" PRIMARY KEY("symbol","settlement_date")
);
--> statement-breakpoint
CREATE TABLE "finra_short_volume" (
	"symbol" varchar(32) NOT NULL,
	"trade_date" date NOT NULL,
	"short_volume" bigint NOT NULL,
	"total_volume" bigint NOT NULL,
	CONSTRAINT "finra_short_volume_symbol_trade_date_pk" PRIMARY KEY("symbol","trade_date")
);
--> statement-breakpoint
CREATE TABLE "investor_flows_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sec_13f_aggregates" (
	"cusip" char(9) NOT NULL,
	"period" date NOT NULL,
	"holders" integer NOT NULL,
	"shares" bigint NOT NULL,
	"value_usd" bigint NOT NULL,
	"new_holders" integer,
	"increased" integer,
	"decreased" integer,
	"exited" integer,
	"net_share_change" bigint,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sec_13f_aggregates_cusip_period_pk" PRIMARY KEY("cusip","period")
);
--> statement-breakpoint
CREATE TABLE "sec_13f_dirty_aggregates" (
	"period" date NOT NULL,
	"cusip_id" integer NOT NULL,
	CONSTRAINT "sec_13f_dirty_aggregates_period_cusip_id_pk" PRIMARY KEY("period","cusip_id")
);
--> statement-breakpoint
CREATE TABLE "sec_13f_filers" (
	"cik" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sec_13f_filings" (
	"accession" varchar(20) PRIMARY KEY NOT NULL,
	"cik" integer NOT NULL,
	"period" date,
	"filing_date" date NOT NULL,
	"submission_type" varchar(16) NOT NULL,
	"amendment_type" varchar(32),
	"attempts" smallint DEFAULT 0 NOT NULL,
	"last_error" text,
	"processed_at" timestamp with time zone,
	"universe_stamp" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sec_13f_positions" (
	"shares" bigint NOT NULL,
	"cik" integer NOT NULL,
	"cusip_id" integer NOT NULL,
	"period" date NOT NULL,
	"value_k" integer NOT NULL,
	CONSTRAINT "sec_13f_positions_cik_period_cusip_id_pk" PRIMARY KEY("cik","period","cusip_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "cusip_symbol_map_cusip_uidx" ON "cusip_symbol_map" USING btree ("cusip");--> statement-breakpoint
CREATE INDEX "cusip_symbol_map_symbol_idx" ON "cusip_symbol_map" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "finra_short_interest_settlement_date_idx" ON "finra_short_interest" USING btree ("settlement_date");--> statement-breakpoint
CREATE INDEX "finra_short_volume_trade_date_idx" ON "finra_short_volume" USING btree ("trade_date");--> statement-breakpoint
CREATE INDEX "sec_13f_filings_cik_period_idx" ON "sec_13f_filings" USING btree ("cik","period");--> statement-breakpoint
CREATE INDEX "sec_13f_filings_filing_date_idx" ON "sec_13f_filings" USING btree ("filing_date");--> statement-breakpoint
CREATE INDEX "sec_13f_filings_pending_idx" ON "sec_13f_filings" USING btree ("filing_date") WHERE "sec_13f_filings"."processed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "sec_13f_filings_period_cik_processed_idx" ON "sec_13f_filings" USING btree ("period","cik") WHERE "sec_13f_filings"."processed_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "sec_13f_positions_cusip_period_idx" ON "sec_13f_positions" USING btree ("cusip_id","period");--> statement-breakpoint
CREATE INDEX "sec_13f_positions_period_brin_idx" ON "sec_13f_positions" USING brin ("period");
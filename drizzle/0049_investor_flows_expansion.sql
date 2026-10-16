CREATE TABLE "dart_corp_code" (
	"stock_code" varchar(6) PRIMARY KEY NOT NULL,
	"corp_code" char(8) NOT NULL,
	"corp_name" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dart_insider_reports" (
	"rcept_no" varchar(14) NOT NULL,
	"corp_code" char(8) NOT NULL,
	"receipt_date" date NOT NULL,
	"reporter" text NOT NULL,
	"position" text,
	"registered" boolean,
	"major_shareholder" text,
	"shares" bigint,
	"shares_change" bigint,
	"ratio_pct" numeric(8, 4),
	"ratio_change_pct" numeric(8, 4),
	CONSTRAINT "dart_insider_reports_rcept_no_reporter_pk" PRIMARY KEY("rcept_no","reporter")
);
--> statement-breakpoint
CREATE TABLE "dart_major_holdings" (
	"rcept_no" varchar(14) NOT NULL,
	"corp_code" char(8) NOT NULL,
	"receipt_date" date NOT NULL,
	"reporter" text NOT NULL,
	"report_form" varchar(16) NOT NULL,
	"shares" bigint,
	"shares_change" bigint,
	"ratio_pct" numeric(8, 4),
	"ratio_change_pct" numeric(8, 4),
	"reason" text,
	CONSTRAINT "dart_major_holdings_rcept_no_reporter_pk" PRIMARY KEY("rcept_no","reporter")
);
--> statement-breakpoint
CREATE TABLE "dart_trading_plans" (
	"rcept_no" varchar(14) PRIMARY KEY NOT NULL,
	"corp_code" char(8) NOT NULL,
	"receipt_date" date NOT NULL,
	"reporter" text NOT NULL,
	"title" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reg_sho_threshold" (
	"symbol" varchar(32) NOT NULL,
	"trade_date" date NOT NULL,
	"market" varchar(16) NOT NULL,
	CONSTRAINT "reg_sho_threshold_symbol_trade_date_market_pk" PRIMARY KEY("symbol","trade_date","market")
);
--> statement-breakpoint
CREATE TABLE "sec_13f_option_aggregates" (
	"cusip" char(9) NOT NULL,
	"period" date NOT NULL,
	"put_holders" integer NOT NULL,
	"put_shares" bigint NOT NULL,
	"put_value_usd" bigint NOT NULL,
	"call_holders" integer NOT NULL,
	"call_shares" bigint NOT NULL,
	"call_value_usd" bigint NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sec_13f_option_aggregates_cusip_period_pk" PRIMARY KEY("cusip","period")
);
--> statement-breakpoint
CREATE TABLE "sec_13f_option_positions" (
	"cik" integer NOT NULL,
	"cusip" char(9) NOT NULL,
	"period" date NOT NULL,
	"put_call" varchar(4) NOT NULL,
	"shares" bigint NOT NULL,
	"value_usd" bigint NOT NULL,
	CONSTRAINT "sec_13f_option_positions_cik_cusip_period_put_call_pk" PRIMARY KEY("cik","cusip","period","put_call")
);
--> statement-breakpoint
CREATE TABLE "sec_cik_symbol_map" (
	"cik" integer NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sec_cik_symbol_map_cik_symbol_pk" PRIMARY KEY("cik","symbol")
);
--> statement-breakpoint
CREATE TABLE "sec_filings_failures" (
	"accession" varchar(20) PRIMARY KEY NOT NULL,
	"cik" integer NOT NULL,
	"form_type" varchar(16) NOT NULL,
	"filing_date" date NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"last_error" text,
	"skipped" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sec_form144" (
	"accession" varchar(20) PRIMARY KEY NOT NULL,
	"issuer_cik" integer NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"filer_name" text NOT NULL,
	"relationships" text[] NOT NULL,
	"security_class" text NOT NULL,
	"shares" bigint NOT NULL,
	"value_usd" bigint NOT NULL,
	"shares_outstanding" bigint,
	"approx_sale_date" date,
	"plan_adoption_date" date,
	"broker" text,
	"form_type" varchar(16) NOT NULL,
	"filing_date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sec_ftd" (
	"cusip" char(9) NOT NULL,
	"settlement_date" date NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"fails_qty" bigint NOT NULL,
	"price" numeric(14, 4),
	CONSTRAINT "sec_ftd_cusip_settlement_date_pk" PRIMARY KEY("cusip","settlement_date")
);
--> statement-breakpoint
CREATE TABLE "sec_ftd_files" (
	"file_key" varchar(8) PRIMARY KEY NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"processed_at" timestamp with time zone,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "sec_offering_filings" (
	"accession" varchar(20) NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"issuer_cik" integer NOT NULL,
	"form_type" varchar(16) NOT NULL,
	"filing_date" date NOT NULL,
	"kind" varchar(24) NOT NULL,
	"url" text NOT NULL,
	CONSTRAINT "sec_offering_filings_accession_symbol_pk" PRIMARY KEY("accession","symbol")
);
--> statement-breakpoint
CREATE INDEX "dart_insider_reports_corp_code_receipt_date_idx" ON "dart_insider_reports" USING btree ("corp_code","receipt_date");--> statement-breakpoint
CREATE INDEX "dart_major_holdings_corp_code_receipt_date_idx" ON "dart_major_holdings" USING btree ("corp_code","receipt_date");--> statement-breakpoint
CREATE INDEX "dart_trading_plans_corp_code_receipt_date_idx" ON "dart_trading_plans" USING btree ("corp_code","receipt_date");--> statement-breakpoint
CREATE INDEX "reg_sho_threshold_trade_date_idx" ON "reg_sho_threshold" USING btree ("trade_date");--> statement-breakpoint
CREATE INDEX "sec_13f_option_positions_cusip_period_idx" ON "sec_13f_option_positions" USING btree ("cusip","period");--> statement-breakpoint
CREATE INDEX "sec_13f_option_positions_period_brin_idx" ON "sec_13f_option_positions" USING brin ("period");--> statement-breakpoint
CREATE INDEX "sec_cik_symbol_map_symbol_idx" ON "sec_cik_symbol_map" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "sec_form144_issuer_cik_filing_date_idx" ON "sec_form144" USING btree ("issuer_cik","filing_date");--> statement-breakpoint
CREATE INDEX "sec_form144_filing_date_idx" ON "sec_form144" USING btree ("filing_date");--> statement-breakpoint
CREATE INDEX "sec_ftd_symbol_settlement_date_idx" ON "sec_ftd" USING btree ("symbol","settlement_date");--> statement-breakpoint
CREATE INDEX "sec_ftd_settlement_date_idx" ON "sec_ftd" USING btree ("settlement_date");--> statement-breakpoint
CREATE INDEX "sec_offering_filings_symbol_filing_date_idx" ON "sec_offering_filings" USING btree ("symbol","filing_date");--> statement-breakpoint
CREATE INDEX "sec_offering_filings_filing_date_idx" ON "sec_offering_filings" USING btree ("filing_date");
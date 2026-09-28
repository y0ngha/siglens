CREATE TABLE "symbol_views_daily" (
	"date" date NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"views" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "symbol_views_daily_date_symbol_pk" PRIMARY KEY("date","symbol")
);

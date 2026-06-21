CREATE TABLE "crypto_assets" (
	"symbol" varchar(32) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"korean_name" text,
	"circulating_supply" double precision,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

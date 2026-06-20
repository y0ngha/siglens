CREATE TABLE "economic_indicator_translations" (
	"normalized_name" text PRIMARY KEY NOT NULL,
	"korean_name" text NOT NULL,
	"source" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

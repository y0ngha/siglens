CREATE TABLE "profile_description_translations" (
	"symbol" varchar(32) PRIMARY KEY NOT NULL,
	"description_ko" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

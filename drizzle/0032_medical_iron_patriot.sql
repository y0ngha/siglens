CREATE TABLE "visitor_days" (
	"visitor_hash" text NOT NULL,
	"date" date NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visitor_days_date_visitor_hash_pk" PRIMARY KEY("date","visitor_hash")
);

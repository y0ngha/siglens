CREATE TABLE "signal_scan_cursors" (
	"market" varchar(8) NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"last_session" date,
	"attempt_session" date,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"last_outcome" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signal_scan_cursors_market_symbol_pk" PRIMARY KEY("market","symbol"),
	CONSTRAINT "signal_scan_cursors_last_outcome_check" CHECK ("signal_scan_cursors"."last_outcome" IN ('recorded','failed','stale'))
);
--> statement-breakpoint
CREATE TABLE "signal_scan_sessions" (
	"market" varchar(8) NOT NULL,
	"session_date" date NOT NULL,
	"universe_size" integer NOT NULL,
	"recorded" integer NOT NULL,
	"failed" integer NOT NULL,
	"stale" integer NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signal_scan_sessions_market_session_date_pk" PRIMARY KEY("market","session_date")
);

CREATE TABLE "signal_events" (
	"market" varchar(8) NOT NULL,
	"session_date" date NOT NULL,
	"last_seen_session" date NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"signal_type" varchar(48) NOT NULL,
	"direction" varchar(8) NOT NULL,
	"change_percent" double precision NOT NULL,
	"korean_name" text,
	"computed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signal_events_market_session_date_symbol_signal_type_pk" PRIMARY KEY("market","session_date","symbol","signal_type")
);
--> statement-breakpoint
CREATE INDEX "signal_events_type_date_idx" ON "signal_events" USING btree ("signal_type","session_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "signal_events_open_episode_idx" ON "signal_events" USING btree ("market","symbol","signal_type","last_seen_session");
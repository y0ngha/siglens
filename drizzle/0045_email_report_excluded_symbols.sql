CREATE TABLE "email_report_excluded_symbols" (
	"user_id" uuid NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_report_excluded_symbols_user_id_symbol_pk" PRIMARY KEY("user_id","symbol")
);
--> statement-breakpoint
ALTER TABLE "email_report_excluded_symbols" ADD CONSTRAINT "email_report_excluded_symbols_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
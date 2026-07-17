CREATE TABLE "portfolio_holdings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"company_name" text,
	"fmp_symbol" text,
	"quantity" numeric(24, 8) NOT NULL,
	"average_price" numeric(20, 8) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portfolio_holdings" ADD CONSTRAINT "portfolio_holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "portfolio_holdings_user_id_idx" ON "portfolio_holdings" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "portfolio_holdings_user_symbol_uidx" ON "portfolio_holdings" USING btree ("user_id","symbol");
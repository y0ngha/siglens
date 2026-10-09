CREATE TABLE "watchlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"company_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "watchlist_items_user_id_idx" ON "watchlist_items" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "watchlist_items_user_symbol_uidx" ON "watchlist_items" USING btree ("user_id","symbol");
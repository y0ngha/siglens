CREATE TYPE "public"."terms_kind" AS ENUM('privacy', 'tos');--> statement-breakpoint
CREATE TABLE "agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"terms_id" uuid NOT NULL,
	"agreed" boolean NOT NULL,
	"agreed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "terms_kind" NOT NULL,
	"version" integer NOT NULL,
	"effective_date" timestamp with time zone NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_terms_id_terms_id_fk" FOREIGN KEY ("terms_id") REFERENCES "public"."terms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agreements_user_terms_uidx" ON "agreements" USING btree ("user_id","terms_id");--> statement-breakpoint
CREATE INDEX "agreements_user_id_idx" ON "agreements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agreements_terms_id_idx" ON "agreements" USING btree ("terms_id");--> statement-breakpoint
CREATE UNIQUE INDEX "terms_kind_version_uidx" ON "terms" USING btree ("kind","version");--> statement-breakpoint
CREATE INDEX "terms_kind_effective_date_idx" ON "terms" USING btree ("kind","effective_date");
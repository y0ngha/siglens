CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(16) NOT NULL,
	"surface" varchar(16) NOT NULL,
	"rating" smallint,
	"vote" varchar(8),
	"reasons" jsonb,
	"comment" text,
	"target_type" varchar(32),
	"symbol" varchar(32),
	"context" jsonb NOT NULL,
	"snapshot" jsonb,
	"user_id" uuid,
	"conversation_id" uuid,
	"page_path" text,
	"locale" "content_locale" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_rating_range" CHECK ("feedback"."rating" IS NULL OR ("feedback"."rating" BETWEEN 1 AND 5))
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_created_at_idx" ON "feedback" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "feedback_kind_created_at_idx" ON "feedback" USING btree ("kind","created_at");
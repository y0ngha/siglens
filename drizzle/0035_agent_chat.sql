CREATE TABLE "chat_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(120) NOT NULL,
	"locale" "content_locale" NOT NULL,
	"model_id" varchar(64) NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"role" varchar(16) NOT NULL,
	"content" text NOT NULL,
	"tool_calls" jsonb,
	"tool_call_id" varchar(64),
	"tool_name" varchar(64),
	"model_id" varchar(64),
	"usage" jsonb,
	"status" varchar(16) DEFAULT 'complete' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_conversations_user_recent_idx" ON "chat_conversations" USING btree ("user_id","last_message_at" DESC NULLS LAST) WHERE "chat_conversations"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_conversation_seq_uq" ON "chat_messages" USING btree ("conversation_id","seq");
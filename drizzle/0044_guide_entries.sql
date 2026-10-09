CREATE TABLE "guide_entries" (
	"slug" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"sort_order" integer NOT NULL,
	"related" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"skills" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guide_entry_contents" (
	"slug" text NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"aliases" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"summary" text NOT NULL,
	"seo_title" text NOT NULL,
	"seo_description" text NOT NULL,
	"demo_caption" text,
	"body_md" text NOT NULL,
	"faq" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guide_entry_contents_slug_locale_pk" PRIMARY KEY("slug","locale")
);
--> statement-breakpoint
ALTER TABLE "guide_entry_contents" ADD CONSTRAINT "guide_entry_contents_slug_guide_entries_slug_fk" FOREIGN KEY ("slug") REFERENCES "public"."guide_entries"("slug") ON DELETE cascade ON UPDATE no action;

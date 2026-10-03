CREATE TABLE "analysis_plain_texts" (
	"prompt_version" text NOT NULL,
	"locale" text NOT NULL,
	"input_digest" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analysis_plain_texts_prompt_version_locale_input_digest_pk" PRIMARY KEY("prompt_version","locale","input_digest")
);

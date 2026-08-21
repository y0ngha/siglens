-- DB 콘텐츠 다국어 축 (설계 §2.5). expand 단계.
--
-- ⚠️ 순서: (1) **이 마이그레이션** → (2) 코드 배포 → (3) 0030 → (4) 백필 →
--    (5) 번역 → (6) 점검 → (7) `DB_CONTENT_LOCALE=1`.
--
-- ⛔ 코드를 먼저 배포하면 안 된다. 스위치가 꺼져 있어도 쓰기 경로는 `locale`
--    컬럼을 **넣는다** — Drizzle이 스키마에 있는 컬럼을 values에서 빼도
--    `default`로 항상 INSERT에 넣기 때문이다(실측: `values({...}).toSQL()`,
--    회귀 가드 `src/entities/seo-snapshot/__tests__/upsertSql.test.ts`).
--    컬럼 없이 그 코드가 뜨면 공유 스냅샷 생성과 프리웜 크론이
--    `column "locale" does not exist`로 죽는다.
--
-- 반대로 이 마이그레이션이 **먼저** 가는 것은 안전하다: additive라 구 코드의
-- `INSERT ... ON CONFLICT (symbol, tab)`이 그대로 매칭되고 `locale`은 기본값
-- `ko`로 채워진다. 구 unique 인덱스(`seo_analysis_snapshots_symbol_tab_uq`)를
-- **일부러 남긴다** — 그것을 지우는 것이 0030(contract 단계)이다.
--
-- ⛔ `yarn db:migrate`는 저널 전체를 훑으므로 그대로 치면 0030까지 간다.
--    1단계에서는 반드시 `yarn db:migrate --until 0029_content_locale`.

CREATE TYPE "public"."content_locale" AS ENUM('ko', 'en', 'ja', 'zh');--> statement-breakpoint
CREATE TABLE "content_translations" (
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"field" text NOT NULL,
	"locale" "content_locale" NOT NULL,
	"value" text NOT NULL,
	"source" text DEFAULT 'ai' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_translations_entity_entity_id_field_locale_pk" PRIMARY KEY("entity","entity_id","field","locale")
);
--> statement-breakpoint
ALTER TABLE "seo_analysis_snapshots" ADD COLUMN "locale" "content_locale" DEFAULT 'ko' NOT NULL;--> statement-breakpoint
ALTER TABLE "shared_analyses" ADD COLUMN "locale" "content_locale" DEFAULT 'ko' NOT NULL;--> statement-breakpoint
CREATE INDEX "content_translations_entity_locale_idx" ON "content_translations" USING btree ("entity","locale","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_analysis_snapshots_symbol_tab_locale_uq" ON "seo_analysis_snapshots" USING btree ("symbol","tab","locale");
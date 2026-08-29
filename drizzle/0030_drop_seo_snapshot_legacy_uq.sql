-- 0029의 contract 단계 — 구 unique 인덱스 제거.
--
-- ⛔ **코드 배포(2단계)가 전 인스턴스에 반영된 뒤에만.** 배포된 구 코드는
--    `ON CONFLICT (symbol, tab)`을 쓰는데 이 인덱스를 지우면 프리웜이
--    42P10(`no unique or exclusion constraint matching the ON CONFLICT
--    specification`)으로 죽는다. 그래서 1단계는 반드시
--    `yarn db:migrate --until 0029_content_locale`로 멈춰야 한다.
--
-- ⛔ **스위치를 켜기 전에 적용해야 한다.** 구 unique가 살아 있는 동안 같은
--    `(symbol, tab)`에 두 번째 로케일 행을 넣으면 23505로 죽는다(로컬 실증).
--    스위치를 켜는 순간 비-ko 프리웜이 시작되므로 그 전에 지워져 있어야 한다.
--
-- 적용 뒤에는 **구 코드로 롤백하면 안 된다** — 2열 타깃이 가리킬 인덱스가 없다.
-- 스위치(`DB_CONTENT_LOCALE`)는 읽기만 가리므로 언제든 내릴 수 있다.

DROP INDEX "seo_analysis_snapshots_symbol_tab_uq";
-- visitor_days.landing_path에 남은 공유 링크 id와 AI 대화 id를 지운다(개인정보처리방침 v15 §2: 주소의 식별자 부분은 저장하지 않는다).
-- 새 코드(`collapseLandingPath`)는 저장 전에 `/share/:id`·`/c/:id`로 접지만, 그 전에 쌓인 행(최대 400일치)에는 원본이 남아 있다.
-- 되돌릴 수 없는 데이터 수정이다: 지운 식별자는 복구되지 않는다. 영향 행 수는 운영에서 실행해 봐야 안다.
-- 멱등이다: 이미 접힌 경로(`/share/:id`, `/c/:id`)와 무관한 경로는 WHERE에서 빠지므로 다시 실행해도 같은 결과다.
-- 로케일 접두사는 선택이다(`ko`는 접두사가 없지만 옛 링크가 `/ko/…`로 남았을 수 있어 넷 모두 받는다). 한 세그먼트 뒤의 경로(`/share/<id>/extra`)도 접는다.
-- AI 대화 경로는 옛 행의 landing_site가 NULL이라 사이트로 가를 수 없다. 대화 id는 uuid이므로 uuid 모양인 세그먼트만 접는다
-- — 메인 사이트의 종목 경로(`/c`, `/c/news`)는 건드리지 않는다.
-- 적용 전 점검(운영자): 먼저 백업을 받고, 아래 읽기 전용 SELECT 두 개로 영향 행 수를 확인한다. WHERE가 각 UPDATE와 같다.
-- SELECT count(*) FROM "visitor_days" WHERE "landing_path" ~ '^(/(ko|en|ja|zh))?/share/[^/]+(/.*)?$' AND "landing_path" !~ '^(/(ko|en|ja|zh))?/share/:id$';
-- SELECT count(*) FROM "visitor_days" WHERE "landing_path" ~ '^(/(ko|en|ja|zh))?/c/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(/.*)?$';
UPDATE "visitor_days" SET "landing_path" = regexp_replace("landing_path", '^(/(?:ko|en|ja|zh))?/share/[^/]+(?:/.*)?$', '\1/share/:id') WHERE "landing_path" ~ '^(/(ko|en|ja|zh))?/share/[^/]+(/.*)?$' AND "landing_path" !~ '^(/(ko|en|ja|zh))?/share/:id$';--> statement-breakpoint
UPDATE "visitor_days" SET "landing_path" = regexp_replace("landing_path", '^(/(?:ko|en|ja|zh))?/c/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?:/.*)?$', '\1/c/:id') WHERE "landing_path" ~ '^(/(ko|en|ja|zh))?/c/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(/.*)?$';

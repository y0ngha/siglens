-- privacy v3 의 발효일을 2026-09-19 → 2026-09-10 00:00 KST 로 앞당긴다.
--
-- `db/seeds/terms/privacy/v3.md` 의 frontmatter 를 고치는 것만으로는 부족하다.
-- `upsertFromSeed` 가 `(kind, version)` 충돌에 `onConflictDoNothing` 이라
-- (발효된 본문을 조용히 바꾸지 않기 위해 의도된 것이다) 이미 시드된 환경의
-- 행은 옛 발효일 그대로 남는다. 시드 파일은 새 환경에만 효과가 있다.
--
-- 갱신되지 않으면 `findActive` 의 `effective_date <= NOW()` 가 계속 v2 를 고른다.
-- v2 는 User-Agent·접속 국가·진입 경로 수집을 고지하지 않는데, 같은 배포의
-- `/api/presence` 는 게이트 없이 그 셋을 수집하기 시작한다 — 방침보다 수집이
-- 앞서는 상태가 된다. 그래서 데이터 마이그레이션으로 묶는다.
--
-- **바꾸면 `db/seeds/terms/privacy/v3.md` 의 `effectiveDate` 도 같이 바꿔야 한다.**
UPDATE "terms"
SET "effective_date" = '2026-09-09T15:00:00+00'
WHERE "kind" = 'privacy'
  AND "version" = 3
  -- 앞당기기만 한다. 이미 이 값이거나 더 이른 환경에서는 아무 일도 하지 않아
  -- 재실행이 안전하고, 나중에 발효일을 의도적으로 옮겨도 되돌리지 않는다.
  AND "effective_date" > '2026-09-09T15:00:00+00';

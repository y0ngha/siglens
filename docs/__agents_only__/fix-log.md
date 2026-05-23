
# Fix Log

## [PR #432 Round 4 | fix/cancel-job-on-page-unload | 2026-05-09]
- Violation: `route.ts` body validation used `!j.type` (falsy check only), allowing invalid type strings (e.g. `"unknown"`) to pass and silently return 204
  - Rule: Infrastructure Functions — validate all inputs at API boundaries; invalid values must return 400
  - Context: Added `VALID_JOB_TYPES` Set check so unrecognized job types are rejected with 400 rather than logged as a warning and treated as success

## [PR #461 | worktree-agent-adcfb46d349680b0c | 2026-05-23]
- Violation: `URLSearchParams.getAll('q')[0]` 사용 — `get('q')`가 의도(첫 값)를 더 명확히 표현
- Rule: Readability — Web API 표준 동작 활용 (get은 기본적으로 첫 값 반환)
- Context: 동일 키 중복 케이스를 위해 getAll로 시작했으나, get으로도 동일 결과 + 코드 간결화. JSDoc에 "get()이 기본 동작" 명시.
- Violation: `TICKER_SEGMENT_CI_RE` (1-5 chars, .X만)이 `VALID_TICKER_RE` (1-8 chars, .X/하이픈 허용)와 일관성 깨짐 — `?q=PBR-A`는 redirect되지만 `/pbr-a` 직접 진입 시 case 정규화 실패
- Rule: Single source of truth (FF Cohesion 3-A) — 도메인 상수가 authoritative, proxy.ts에서 중복 정의 금지
- Context: TICKER_SEGMENT_CI_RE 제거 후 VALID_TICKER_RE.test(firstSegment.toUpperCase())로 통일. ticker normalization 테스트에 pbr-a/abcdef 케이스 추가.
- Violation: 이미 파싱된 `reqUrl` 객체 있는데 `new URL(req.url)` 재파싱
- Rule: Performance/DRY — 동일 객체를 한 번만 파싱
- Context: ticker 정규화 분기에서 canonicalUrl = new URL(req.url) → new URL(reqUrl)로 변경 (URL clone).
- Violation: 307 status code 사용 이유가 JSDoc에 누락 — ticker 정규화는 301 명시인데 ?q=는 default(307) 사용으로 비대칭
- Rule: Predictability — 다른 곳에서 명시한 항목과 다른 선택은 WHY 문서화 필요
- Context: JSDoc에 "status code는 기본값 307(임시) — 검색 쿼리는 브라우저가 영구 캐싱하지 않도록 의도" 한 줄 추가.

## [PR #467 | perf/lighthouse-audit-cleanup | 2026-05-24]
- Violation: 로컬 미러(`HIGH_CONFIDENCE_WEIGHT`) 제거 시점 추적 메커니즘 부재
- Rule: Predictability — 임시 우회 코드는 제거 조건과 추적 링크를 명시해야 향후 정리가 안정적으로 이루어짐
- Context: PR #467 round 1에서 SkillsShowcase의 siglens-core barrel tree-shake 회피용 인라인을 적용. claude/gemini 두 봇 모두 "원본 라이브러리 재구성으로 제거 가능한 시점 추적이 필요"하다고 지적. siglens-core indicator constants barrel 분리 추적용 이슈 #468 생성 후 JSDoc에 이슈 번호 링크 추가, 양쪽 봇에 답글로 알림.

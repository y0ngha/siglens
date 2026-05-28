
# Fix Log

## [feat/bot-cost-caching Round 1 | feat/bot-cost-caching | 2026-05-28]
- Violation: 'use server' file exported non-async-function constants `POLL_INTERVAL_MS`, `POLL_MAX_ATTEMPTS`
  - Rule: entities/CONVENTIONS.md — 'use server' files may only export async functions; constants must live in separate modules
  - Context: Attempted to export constants in `ensureNewsCardsAnalyzedAction.ts` (a 'use server' file), caused Next.js error 71011. Corrected by moving constants to `lib/newsAnalysisConstants.ts` and importing them.

## [feat/bot-cost-caching Round 1 | feat/bot-cost-caching | 2026-05-28]
- Violation: Global `vi.mock('@upstash/redis', ...)` added to `vitest.setup.base.ts` when per-file mocks + resolve alias sufficed
  - Rule: Test best practices — Global mocks weaken test isolation; per-file mocks keep missing-mock failures visible
  - Context: Removed global mock to maintain test isolation and visibility of unintended missing dependencies.
## [PR #515 Round 1 | fix/0/종목-차트-페이지-ai-분석-높이-고정 | 2026-05-28]
- Violation: 테스트에서 매직 넘버 `80`이 입력값과 단언값으로 중복 등장 (ChartContent.test.tsx, SymbolLayoutClient.test.tsx)
  - Rule: 매직 넘버 상수화 / DRY — 한쪽만 바뀌면 테스트가 조용히 오동작 (MISTAKES.md §15 일반 원칙, Pure Logic 체크리스트 "No hardcoded literals → extract to constants")
  - Context: AI 분석 패널 길이 시뮬레이션 문단 수를 `LONG_PARAGRAPH_COUNT`/`SHORT_PARAGRAPH_COUNT` 상수로 추출
- Violation: globals.css에 Tailwind v4 `@utility` + `&` 중첩 사용 → stylelint `at-rule-no-unknown` / `nesting-selector-no-missing-scoping-root` 오류
  - Rule: lint:style 통과 (`.stylelintrc.cjs`의 `at-rule-no-unknown` ignoreAtRules는 v3 지시어만 등록)
  - Context: 변형 조합이 불필요하므로 동일 파일 관례(`.hero-report-lines`)에 맞춰 일반 클래스 + `::-webkit-scrollbar` 별도 셀렉터로 전환

## [PR #513 Round 1 | fix/fear-greed-ssr-and-fmp-retry | 2026-05-26]
- Violation: `page.tsx` prefetch 배열에 `.push()` 사용 — 배열 직접 변이
  - Rule: MISTAKES.md §5 — Array/object mutation via push/splice 금지
  - Context: 차트 페이지에서 조건부 prefetch를 추가할 때 spread 대신 push를 사용. spread 패턴으로 교체

## [PR #432 Round 4 | fix/cancel-job-on-page-unload | 2026-05-09]
- Violation: `route.ts` body validation used `!j.type` (falsy check only), allowing invalid type strings (e.g. `"unknown"`) to pass and silently return 204
  - Rule: Infrastructure Functions — validate all inputs at API boundaries; invalid values must return 400
  - Context: Added `VALID_JOB_TYPES` Set check so unrecognized job types are rejected with 400 rather than logged as a warning and treated as success

## [feat/fundamental-redis-cache Round 2 | feat/fundamental-redis-cache | 2026-05-29]
- Violation: `beforeEach/afterEach` hooks declared at module level instead of inside describe block in src/shared/cache/__tests__/getOrSetCache.test.ts
  - Rule: MISTAKES.md Tests #3 — Test lifecycle hooks must be inside describe block
  - Context: Moved beforeEach/afterEach into describe block to group with test cases
- Violation: TTL value duplicated inline (SECONDS_PER_HOUR) in src/app/[symbol]/news/newsData.ts instead of sharing with fundamentalData.ts
  - Rule: MISTAKES.md #16.5 / FF Cohesion — Shared constants must use single named constant
  - Context: Exported FMP_FUNDAMENTAL_REVALIDATE_SECONDS from fundamentalClient.ts and imported in both newsData and fundamentalData
- Violation: `shouldCache` predicate wrongly withheld caching of empty arrays in src/app/[symbol]/fundamental/fundamentalData.ts + news/newsData.ts
  - Rule: Caching behavior — empty arrays are stable results and should be cached
  - Context: Changed `v => v.length > 0` to `v => v !== null`, allowing empty arrays to be cached as valid results
## [refactor/fear-greed-import-core Round 2 | refactor/fear-greed-import-core | 2026-05-28]
- Violation: Test mock `SENTIMENT_LABEL_TEXT` object used lowercase keys (`extreme_fear`, `extreme_greed`, `fear`, `greed`, `neutral`, `optimism`) while production `FearGreedLabel` union is uppercase (`EXTREME_FEAR`, `EXTREME_GREED`, `FEAR`, `GREED`, `NEUTRAL`, `OPTIMISM`)
  - Rule: MISTAKES.md §Tests 13 — Test mock must faithfully replicate production interface; divergent key casing breaks type safety and tests silently return undefined lookups
  - Context: Mock did not match production casing; also had 4 lowercase `label={'x' as FearGreedLabel}` casts. Corrected mock keys and removed unsafe casts.
- Violation: Test comment/title referenced deleted `classifyScore` identifier (renamed to `scoreToLabel` from siglens-core import)
  - Rule: MISTAKES.md §15.6 — Comments/JSDoc must match current code reality; stale identifier names after renames mislead readers
  - Context: After importing `scoreToLabel` from `@y0ngha/siglens-core@0.15.0`, test title still referenced old `classifyScore` name. Updated to reflect actual import.



# Fix Log


## [PR #545 Round 4 | fix/symbol-infra-fallback | 2026-06-02]
- Violation: 테스트 mock 객체에서 AssetInfo required 필드 `symbol` 누락
  - Rule: MISTAKES.md §TypeScript §2 — Mock 객체는 실제 타입 계약과 일치해야 함
  - Context: `page.test.ts`와 `overall/__tests__/page.test.ts`의 mockGetAssetInfoResilient 모든 assetInfo 객체에 symbol 필드 누락
- Violation: `ResilientAssetInfo` 타입이 barrel에서 export되지 않음
  - Rule: CONVENTIONS.md FSD — production 코드는 슬라이스 barrel만 import
  - Context: 함수 반환 타입인 `ResilientAssetInfo`를 직접 type annotation해야 할 때 barrel에 없으면 deep import 강제


## [PR #545 Round 1 | fix/symbol-infra-fallback | 2026-06-02]
- Violation: 변수명 `mockGetAssetInfoCached`가 실제로는 `getAssetInfoResilient`를 참조 (2개 파일)
  - Rule: MISTAKES.md §11 — 함수/변수명은 실제 참조 대상과 정확하게 일치해야 한다
  - Context: PR #545에서 `getAssetInfoCached` → `getAssetInfoResilient`로 교체 후 테스트 변수명 rename이 누락됨

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

## [PR #546 Round 2 | fix/fear-greed-h1-dup | 2026-06-03]
- Status: APPROVED (both rounds, zero findings)
  - Review: Removed duplicate ticker in h1 (`AAPL` duplicated because displayName + explicit ticker append) across 4 spots (fear-greed/page.tsx: h1, FAQ JSON-LD, guide; [symbol]/page.tsx: sr-only)
  - Result: Clean merge — no violations logged

## [fix/market-summary-load-error-notice Round 2 | fix/market-summary-load-error-notice | 2026-06-03]
- Violation: `role="alert"` element (implicit `aria-live="assertive"`) nested inside `<section aria-live="polite">`, creating competing/overlapping live regions
  - Rule: WAI-ARIA best practices — Nested live regions with different urgency levels (assertive + polite) cause conflicting announcements
  - Context: Market notice alert nested in polite section. Moved `aria-live="polite"` off section to the data div instead, so alert sits outside and announces independently with assertive priority.

## [feat/symbol-seo-e2e-gaps Round 1 | feat/symbol-seo-e2e-gaps | 2026-06-03]
- Violation: E2E authed spec (account-logout.spec.ts) performed destructive auth action on shared seeded session
  - Rule: E2E — Authed-by-filename specs must override storageState + self-provision throwaway user before destructive auth actions
  - Context: account-logout.spec.ts inherits SHARED storageState from setup/user.json, then logs out and destroys that single seeded session. Siblings (account-auth-smoke, account-api-key) fail afterward (nondeterministic order). Pattern already solved in account-delete.spec.ts (test.use({ storageState: { cookies: [], origins: [] } }) + 3-phase signup). This is the second occurrence of the same isolation hazard.

## [test/vitest-e2e-env-leak-cleanup Round 1 | test/vitest-e2e-env-leak-cleanup | 2026-06-03]
- Status: APPROVED (zero findings)
  - Review: Fixed non-deterministic CI vitest flake under `pool: 'vmThreads'`. vi.stubEnv() with default `unstubEnvs: false` leaked `E2E_TEST=1` into env-agnostic factory tests. Fix: `unstubEnvs: true` in vitest.config + global `afterEach` in vitest.setup.base.ts restoring `process.env.E2E_TEST` to its worker-start value.
  - Result: Clean merge — no violations logged

## [PR #562 Round 2 | worktree-verify-0.15-current | 2026-06-04]
- Violation: Manual markdown-notice seeds (priority 100) left in shared docker e2e DB masked 3 existing notice specs (priority 99) → wrong-data failures
  - Rule: MISTAKES.md E2E #2 — delete manual seeds after verification; leftover high-priority rows hide per-test seeds
  - Context: Deleted leftover seeds; re-run passed. Added cleanup step to docs/qa/QA_ENV_SETUP.md §7.
- Violation: Esc-advances-notice unit test flaked only on CI (vmThreads) — keyDown fired before useEscapeKey passive-effect listener attached
  - Rule: MISTAKES.md Tests #19 — await a same-effect-batch sibling (dialog focus) before dispatching; do not blind-bump timeouts
  - Context: Added `waitFor(() => dialog toHaveFocus)` before `fireEvent.keyDown`. Local single + full suite (4887 tests) already green; targeted the race, not the timeout.

## [PR #564 | fix/fmp-cache-and-earnings-gate | 2026-06-04]
- Violation: Redis 캐시 키(buildBarsRawKey)가 GetBarsOptions의 일부 필드만 포함(limit 누락) → 옵션 확장 시 서로 다른 요청이 같은 캐시를 반환할 충돌 위험
  - Rule: (신규) 캐시 키는 결과에 영향을 줄 수 있는 모든 입력 필드를 포함해야 한다 (cache key must cover every result-affecting input field)
  - Context: CachedMarketDataProvider.buildBarsRawKey에 limit 포함(Gemini 리뷰 반영). limit은 timeframe 종속이라 분할 없이 미래 충돌만 방지. (B1 entities/lib Date.now() 순수함수 위반은 MISTAKES §Architecture #0.7 / Tests #14에 이미 문서화되어 기록 생략.)
- Violation: getNextEarningsReport가 entities/lib에서 side effect(Date.now/DB/FMP) 포함 — 순수 함수 레이어 위반 (pre-existing, R3 Blocker)
  - Rule: MISTAKES §Architecture #0.7 — entities/{slice}/lib/는 순수 함수 전용
  - Context: PR #564 R3 claude 리뷰에서 Blocker로 지적. pre-existing이라 별도 PR로 분리(이슈 #565). nextEarningsReport.ts JSDoc에 TODO(#565) 링크를 남겨 추적. 이번 PR diff엔 미수정(scope = 캐시/gate).

## [feat/isr-writes-opt | 2026-06-06]
- Violation: Over-broad early-return skipped required downstream logic
  - Rule: MISTAKES.md Code Review #3 — when adding early return / gate, verify it does not skip unrelated downstream side-effects that must always run
  - Context: Task 5 gated both `revalidateTag` AND the analyze step behind `if (changedCount === 0) return;`. The analyze step processes ALL un-analyzed DB rows (via listBySymbol), not just newly-changed ones, so the early return would strand previously-failed analyses permanently. Fixed by gating only revalidateTag and letting control fall through to analyze.
- Violation: Partial quantization left parallel data structure churning
  - Rule: MISTAKES.md Code Review #4 — when transforming paired/parallel data structures (bars ↔ indicators), transform BOTH in lockstep, or the fix is partial
  - Context: Price quantize sliced bars (drop forming daily bar) but left parallel IndicatorResult per-bar arrays (rsi/macd/etc.) un-sliced. buildTechnicalFacts read forming-bar RSI/MACD and dehydrated seed serialized churning indicators, re-introducing ISR-write driver. Fixed by slicing bars AND all per-bar indicator arrays in lockstep.


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

## [PR #573 Round 2 | feat/isr-writes-opt | 2026-06-06]
- Violation: vi.mock() declaration sandwiched between import statements (before + after)
  - Rule: MISTAKES.md §17 — vi.mock() must sit above all contiguous import block, not split it. Hoisting rules apply
  - Context: quantizeBars.test.ts had imports → vi.mock → imports → vi.mock pattern. Restructured: all vi.mock calls moved above the contiguous import block
- Violation: Unannotated type casts without safety explanation
  - Rule: MISTAKES.md TypeScript §7 — Type casts (as unknown, as Type) must include inline JSDoc explaining why the cast is safe
  - Context: quantizeBars.ts had `(v as unknown[]).slice` (all elements predicate-verified as arrays) and `out as unknown as IndicatorResult` (structural identity). Added explanatory comments for each cast.
- Status: APPROVED (claude round 2, gemini comments addressed, B3 false-positive rejected)
  - Review: Addressed 3 blocker findings (§17, TS §7, missing early return). Rejected B3 (market/page sectorData null cast) as false-positive (getSectorSignalsStatic is non-nullable with no catch).
  - Result: Clean merge — violations logged for future pattern detection

## [PR #573 Round 8 (post-APPROVED) | feat/isr-writes-opt | 2026-06-06]
- Violation: layout.tsx의 `prefetchQuery(getBarsStatic)`이 forming 봉 그대로 dehydrate seed에 박아 ISR write churn을 부분 무력화 (page.tsx만 quantize 적용한 회귀)
  - Rule: 신규 — ISR seed는 RSC가 직접 quantize한 결과만 dehydrate
  - Context: page.tsx에서만 quantize를 적용해도 layout이 nested HydrationBoundary로 forming 봉 bars를 박으면 HTML hash가 매 ISR 재생성마다 다름. layout에도 동일 quantize 적용.
- Violation: RQ `prefetchQuery` 사용 시 dehydrate state의 `dataUpdatedAt: Date.now()`가 매 ISR 재생성마다 다른 ms timestamp를 HTML에 박아 ISR write churn 발생(2026-06-06 실측: 서버 재시작 후 `1780746132068` → `1780746217857`)
  - Rule: 신규 — RQ dehydrate 사용 ISR seed는 `setQueryData(..., { updatedAt: STABLE })` 패턴 필수. `prefetchQuery`는 `updatedAt` 옵션 없어 ISR 결정성 보장 불가
  - Context: layout/page/fear-greed/market/options 5개 페이지 전수 점검. bars seed는 `lastBar.time * 1000` (seconds→ms 변환), assetInfo seed는 `0`(불변), market은 `dateHour:00:00` ms, options는 `snapshot.capturedAt` ms. 빌드 후 두 서버 인스턴스 ISR cache 파일 byte 비교: 사이즈 100% 동일 + dataUpdatedAt 모든 값 IDENTICAL. 잔존 6줄 차이는 React Suspense streaming script로 PR scope 밖.
- Violation: Bar.time이 seconds인데 RQ dataUpdatedAt에 그대로 사용 → 1970년대로 인식 (stale check 어긋남)
  - Rule: 신규 — RQ dataUpdatedAt은 milliseconds. epoch seconds 필드 사용 시 `* 1000` 변환 필수
  - Context: 실측에서 `dataUpdatedAt:1780617600` (10자리 seconds) 박혀 발견. `lastBar.time * 1000`으로 수정.
- Violation: layout.tsx에 [symbol] 차트 페이지 SSR seed 단위 테스트 부재
  - Rule: 신규 — RSC 함수 단위 테스트 (SymbolLayoutChrome named export + quantize/updatedAt mock 검증)
  - Context: 신규 layout.test.tsx 4 케이스(Happy/Worst/degraded/empty-bars). prefetchQuery 회귀 가드 포함.

## [PR #573 Round 7 | feat/isr-writes-opt | 2026-06-06]
- Violation: market/page.test.ts에서 비정밀 단언 `toHaveLength(13) + not.toBe(rawValue)`
  - Rule: MISTAKES.md §13 — exact values are deterministic → use exact assertion
  - Context: dateHour는 `new Date()` 기반 비결정론적이라 vi.setSystemTime으로 시간 고정한 뒤 `toBe('2026-06-04T14')` exact 단언으로 교체. 리뷰는 raw mock value가 quantize 입력이라 오인했지만 실제 quantize는 system time 기반.
- Violation: setWhere 단언이 `toBeDefined()`만으로 약함
  - Rule: MISTAKES.md §13 — Drizzle sql 태그드 객체의 queryChunks 보유 검증으로 강화
  - Context: `toEqual(expect.objectContaining({ queryChunks: expect.any(Array) }))`로 정밀화.
- Violation: WHAT 코멘트 (§15.3)
  - Rule: MISTAKES.md §15.3
  - Context: ensureNewsCardsAnalyzedAction.ts:149 "→ 다음 요청부터 news 리스트/JSON-LD가 fresh." WHAT 라인을 WHY("news 태그만 무효화하므로 bars/peek/profile 캐시는 보존")로 통합.
- Status: APPROVED → merged (예정)

## [PR #573 Round 6 | feat/isr-writes-opt | 2026-06-06]
- Violation: 테스트 인라인 주석 사실 오류 (§15.6)
  - Rule: MISTAKES.md §15.6 — Comments making factually inaccurate claims about code paths
  - Context: ensureNewsCardsAnalyzedAction.test.ts:216 "fresh=[] → upsertSettled 비어 changedCount=0 → revalidateTag 스킵" 첫 줄이 잘못 — 실제로는 `if (fresh.length === 0) return`으로 changedCount 계산 전 early return. 첫 줄 제거하고 단일 설명으로 통합.
- Violation: WHAT 코멘트 (§15.3)
  - Rule: MISTAKES.md §15.3 — Comments should explain WHY, not WHAT
  - Context: `[symbol]/page.tsx:207` "bars seed: quantize된 bars를 동기 setQueryData로 주입한다." 제거. 나머지 WHY 라인 유지.
- Violation: 인라인 반환 타입 (§TypeScript #5.3)
  - Rule: MISTAKES.md §TypeScript #5.3 — Named interface preferred over inline object literal return types
  - Context: api.test.ts:39 makeUpsertDb 인라인 반환 타입을 `interface UpsertDbMock`로 추출.
- Status: APPROVED → merged (예정)

## [PR #573 Round 5 | feat/isr-writes-opt | 2026-06-06]
- Violation: `value as Record<string, unknown>` 캐스트 안전성 주석 누락
  - Rule: MISTAKES.md §TypeScript #7 — every safe-cast must have inline comment explaining the guarantee
  - Context: typeof value === 'object' && value !== null 가드는 있지만 인라인 주석 없음. "safe: guarded by `typeof value === 'object' && value !== null` above — any non-null object is string-indexable, so Object.entries accepts it." 추가.
- Violation: "null, primitive, undefined — pass through" WHAT 주석 (§15.3)
  - Rule: MISTAKES.md §15.3 — Comments should explain WHY, not WHAT
  - Context: 분기 흐름이 의도를 이미 표현 — 주석 제거.
- Violation: 근중복 테스트 케이스 2개 (§Tests #6)
  - Rule: MISTAKES.md §Tests #6 — duplicate test cases with same scenario
  - Context: `revalidateTag 게이팅은` describe 안의 "no-change" 케이스가 위 describe의 "모든 upsert가 false(no-op)" 케이스와 동일 시나리오. 후자 제거(전자가 markFetched 단언 포함해 더 완전), 위치 주석으로 cross-reference.
- Status: APPROVED → merged (예정)
  - Review: 1 Blocker(B1 캐스트 주석) + 2 Suggestion(S1/S2) 반영. Q1 (computedAt 노출 경로 없음) + Q2 (fear-greed page 단위 테스트 한계 — quantize 단위 함수 테스트로 커버) 코멘트 답변.

## [PR #573 Round 4 | feat/isr-writes-opt | 2026-06-06]
- Violation: `.catch(() => null)` 에러 인자 없이 오류 완전 은닉 (fear-greed/page.tsx)
  - Rule: MISTAKES.md §Accessibility §0.5 — `.catch` returning null must log err for diagnostic visibility
  - Context: [symbol]/page.tsx의 동일 `getBarsStatic` 패턴은 console.error 포함했는데 fear-greed/page.tsx만 누락. 진단 가시성 불일치. err 인자 + console.error('[FearGreedPage] getBarsStatic failed:', e) 추가.
- Violation: 테스트 주석 사실 오류 — "analyze 단계는 진입하지만" 주장이 실제 코드와 반대
  - Rule: MISTAKES.md §15.6 — Comments/JSDoc making factually inaccurate claims about the code they describe
  - Context: `fresh.length === 0` early return으로 analyze 단계는 진입하지 않음. 주석을 "if (fresh.length === 0) return으로 early return — analyze 단계에 도달하지 않음"으로 정정. 동시에 MISTAKES.md §Code Review §1 룰을 현재 fresh-derive 설계 기준으로 명확화(safe iff downstream is fresh-derived, unsafe if DB-derived).
- Status: APPROVED → merged
  - Review: 2 Blocker(에러 로깅, 주석 사실오류) 반영. Suggestion(휴리스틱 화이트리스트)은 JSDoc CAVEAT 추가로 대응. Question은 MISTAKES.md 룰 명확화로 해소.

## [feat/polling-intervals Round 1 | feat/polling-intervals | 2026-06-06]
- Violation: DependencyProgress.test.tsx mock had hardcoded constant 3000 instead of importing the updated AUGMENT_AND_OVERALL polling interval value 5000
  - Rule: MISTAKES.md Tests §4 / §13.5 — Boundary test constant redefined locally instead of imported from source; redefining production functions/constants locally in tests (production constant redefined in test)
  - Context: Polling interval constant changed from 3000 to 5000 in production file, but test mock continued using hardcoded 3000. Test now imports the actual constant from the source module.
- Violation: OverallContent.flow.test.tsx JSDoc comment stated "3초" (3 seconds) describing the polling interval; when constant changed to 5000ms, comment became factually inaccurate
  - Rule: MISTAKES.md §15.6 — Comments/JSDoc making factually inaccurate claims about the code they describe (drift trap: constant changes, comment or literal not updated)
  - Context: Polling interval JSDoc referencing hardcoded "3초" removed; code now self-documents through the imported constant name AUGMENT_AND_OVERALL_ANALYSIS_POLLING_INTERVAL_MS.

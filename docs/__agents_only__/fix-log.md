# Fix Log

## [예시 항목 | 브랜치명 | 날짜]
- Violation: 예시
- Rule: 예시
- Context: 예시

## [Issue #130 Round 2 | refactor/130/server-action-migration | 2026-04-05]
- Violation: Domain functions `buildAnalysisPrompt` and `enrichAnalysisWithConfidence` were mocked with `jest.mock()` in an infrastructure test
- Rule: `src/__tests__/CLAUDE.md` — "Never mock domain functions — test them directly with real inputs"
- Context: `analysisApi.test.ts` mocked the domain analysis functions to control test output; since domain functions are pure with no side effects, they must be called with real inputs and only external dependencies (AI API, file I/O) should be mocked

## [PR #189 | fix/176/alpaca-getBars-최신-데이터-반환 | 2026-04-05]
- Violation: `AlpacaBarsResponse` interface declared `next_page_token` in snake_case instead of camelCase
- Rule: CONVENTIONS.md — interface fields must be camelCase; snake_case fields from external APIs must be transformed in infrastructure layer
- Context: `alpaca.ts` typed the raw Alpaca API response directly as the domain interface without transforming the `next_page_token` field to `nextPageToken`

## [PR #189 Round 2 | fix/176/alpaca-getBars-최신-데이터-반환 | 2026-04-05]
- Violation: `ALPACA_SECRET_KEY` env var cleanup placed at end of test body instead of `afterEach`, risking test contamination if assertion fails
- Rule: CONVENTIONS.md Test Rules — test environment teardown must use `afterEach` to guarantee cleanup regardless of assertion outcome
- Context: `alpaca.test.ts` tested the `ALPACA_SECRET_KEY` fallback path by setting the env var inline and deleting it at the last line, but a failed `expect(...).resolves` would skip the deletion

## [PR #189 | fix/176/alpaca-getBars-최신-데이터-반환 | 2026-04-05]
- Violation: `barsApi.test.ts` still referenced removed `AlpacaProvider` class after refactoring to function-based `getBars`
- Rule: MISTAKES.md Tests rule 15 — test mocks must be updated when the implementation changes; class-based mock must become function mock after class removal
- Context: `fetchBarsWithIndicators` was refactored to import `getBars` directly, but the test file kept `AlpacaProvider` class instantiation mock from the old class-based pattern
- Context: In SPA symbol navigation, `useBars` shared a single module-load timestamp across all mounts, causing React Query to treat fresh server data as stale; fixed by replacing `MODULE_LOAD_TIME` with `useState(() => Date.now())` so each mount captures its own timestamp

## [PR #187 Round 2 | refactor/130/server-action-migration | 2026-04-05]
- Violation: `LOOK_AHEAD_COUNT` + `trimmedBars` + `resolvedLimit` fallback in `barsApi.ts` are dead code after `hasMore` was removed
- Rule: MISTAKES.md 9.5 — logic with no practical effect adds noise and obscures intent
- Context: After Server Action migration removed `hasMore` from the response, the code requesting `limit + 1` bars and then slicing back to `limit` served no purpose; simplified to request `limit` directly

## [PR #187 Round 3 | refactor/130/server-action-migration | 2026-04-05]
- Violation: `getBarsAction.ts` and `analyzeAction.ts` were added without corresponding test files
- Rule: CONVENTIONS.md — infrastructure/ coverage 100% required; MISTAKES.md Tests rule 1 — missing test file when creating a new infrastructure file
- Context: Both are thin wrapper Server Actions in `infrastructure/market/` that delegate to `fetchBarsWithIndicators` and `runAnalysis` respectively; test files added verifying delegation behavior and error propagation

## [PR #190 | feat/135/redis-ai-analysis-cache | 2026-04-05]
- Violation: TTL 값이 원시 초 단위 숫자(300, 900...)로 표현되어 의미를 파악하려면 암산이 필요했음
- Rule: FF.md Readability 1-D — 매직 넘버는 이름을 붙이거나 의미가 드러나는 표현식으로 대체해야 함
- Context: `config.ts`의 `ANALYSIS_CACHE_TTL` 상수가 `300`, `86400` 같은 원시 숫자를 사용해 각 타임프레임의 TTL이 얼마인지 즉시 파악 불가능했음; `5 * 60`, `24 * 60 * 60` 형식으로 변경

## [PR #190 | feat/135/redis-ai-analysis-cache | 2026-04-05]
- Violation: `readonlyToken`이 없을 때 동일한 master 토큰으로 Redis 인스턴스를 두 개 생성해 불필요한 리소스 낭비 발생
- Rule: FF.md Cohesion — 같은 역할을 하는 자원은 중복 생성 없이 재사용해야 함
- Context: `redis.ts`의 `createCacheProvider()`에서 readonlyToken 부재 시 reader와 writer가 동일 설정으로 각각 `new Redis()`를 호출했음; writer를 먼저 생성 후 readonlyToken 유무에 따라 조건부로 reader를 생성하도록 수정

## [PR #186 | fix/174/symbol-page-initial-loading-performance | 2026-04-05]
- Violation: 하드코딩된 `initialAnalysisFailed={true}`에 의도 주석 누락
- Rule: FF.md Readability 1-A — 역할이 다른 코드는 분리, 코드의 의도가 명확히 드러나야 함
- Context: SSR 단계에서 AI 분석을 의도적으로 생략하고 클라이언트에 위임하기 위해 `true`로 하드코딩했으나, 코드만으로는 의도를 파악하기 어려워 주석을 추가했다.

## [Issue #175 | feat/175/overlay-legend | 2026-04-05]
- Violation: `while` loop with `let` index variables (`low`, `high`) reassigned in loop body instead of `for` loop
- Rule: CONVENTIONS.md — use `for` loops instead of `while` with mutable index variables; iteration structure should be expressed in the loop header
- Context: `findBarIndex` binary search in `overlayLabelUtils.ts` used a `while` loop with separately declared `let low`/`let high` and index reassignment inside the body; converted to `for (; low <= high; )` with the boundary approximation logic preserved after the loop

## [Issue #175 | feat/175/overlay-legend | 2026-04-05]
- Violation: `prevChartRef` declared and assigned but never read — dead code in hook
- Rule: FF.md Readability — dead code that serves no purpose must be removed; variables assigned but never consumed are noise
- Context: `useOverlayLegend.ts` declared `prevChartRef = useRef<IChartApi | null>(null)` and assigned it inside a `useEffect` branch, but the ref value was never read anywhere; the entire declaration and assignment block was removed

## [Issue #175 | feat/175/overlay-legend | 2026-04-05]
- Violation: Derived variable `barIndex` declared between two `useEffect` calls, violating hook declaration order
- Rule: CONVENTIONS.md Custom Hook Declaration Order — order must be: useState → useRef → derived variables → useEffect
- Context: `useOverlayLegend.ts` placed `const barIndex = ...` between the `barsRef` update effect and the crosshair subscription effect; moved above the first `useEffect` to follow the correct declaration order

## [PR #191 | feat/175/overlay-legend | 2026-04-05]
- Violation: `groupItems` utility function in `OverlayLegend.tsx` used `Array.push()` to mutate local arrays inside a `for...of` loop
- Rule: CONVENTIONS.md Functional Programming — No mutation: `[...arr, item]` not `arr.push(item)`
- Context: `groupItems` called `groups[existingIdx].items.push(item)` and `groups.push(...)` directly; refactored to `reduce` with spread operators to maintain immutability throughout


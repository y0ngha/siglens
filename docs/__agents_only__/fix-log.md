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
- Violation: `prevChartRef` declared and assigned but never read — dead code in hook
- Rule: FF.md Readability — dead code that serves no purpose must be removed; variables assigned but never consumed are noise
- Context: `useOverlayLegend.ts` declared `prevChartRef = useRef<IChartApi | null>(null)` and assigned it inside a `useEffect` branch, but the ref value was never read anywhere; the entire declaration and assignment block was removed

## [PR #191 Round 2 | feat/175/overlay-legend | 2026-04-05]
- Violation: `param.time as number` type assertion used without a type guard in `useOverlayLegend.ts`
- Rule: MISTAKES.md TypeScript #3 — use type guards instead of `as` assertions; exception applies only to DOM elements and third-party library return types with a comment
- Context: `crosshairMove` handler cast `param.time` with `as number` despite `Time` being a union (`UTCTimestamp | BusinessDay | string`); replaced with `typeof param.time === 'number'` guard to ensure runtime safety

- Violation: `Math.max(0, crosshairIndex ?? bars.length - 1)` wraps a potential sentinel `-1` value, silently converting it to `0`
- Rule: MISTAKES.md Domain Functions #9 — sentinel values must propagate unchanged; `Math.max` must not wrap a value that can be `-1`
- Context: `barIndex` derivation in `useOverlayLegend.ts` used `Math.max(0, crosshairIndex ?? ...)` which converts `crosshairIndex = -1` (returned by `findBarIndex` for empty bars) to `0`, producing a wrong index; replaced with explicit null/negative guard chain

## [PR #191 Round 4 | feat/175/overlay-legend | 2026-04-06]
- Violation: `resolveBarIndex` lacked an upper bound guard for `crosshairIndex >= bars.length`, leaving the function contract incomplete
- Rule: FF.md Predictability — pure utility functions must handle all valid input ranges explicitly so callers cannot receive out-of-bounds results
- Context: `overlayLabelUtils.ts` `resolveBarIndex` guarded for null and negative indices but not for indices beyond array bounds; added `if (crosshairIndex >= bars.length) return bars.length - 1` to complete the guard chain

## [PR #191 Round 3 | feat/175/overlay-legend | 2026-04-06]
- Violation: Test comment described `time=250` (tie-break case) but the test body used `time=260` (unambiguous nearest-bar case); the actual tie-break behavior was untested
- Rule: CONVENTIONS.md Test Rules — each `it()` must accurately describe and verify exactly one behavior; misleading comments and untested edge cases must be corrected
- Context: `overlayLabelUtils.test.ts` '중간값일 때' block had a comment about equal-distance tie-break but tested an unambiguous `time=260` input; fixed the comment and added a dedicated '두 후보와 거리가 동일할 때' block verifying that `findBarIndex` returns the lower array index (`low`) when distances are equal

## [feat/157/fmp-provider | 2026-04-06]
- Violation: `eslint-disable-next-line @typescript-eslint/no-unused-vars` comment used on `_now` parameter in `FmpProvider.getBars`
- Rule: CONVENTIONS.md — eslint-disable comments are absolutely prohibited; the root cause must be fixed instead
- Context: `fmp.ts` declared `_now?: string` to match the `MarketDataProvider` interface but never used it; since the parameter is optional in the interface, it can be omitted from the implementation entirely; the parameter was removed to fix the root cause without a suppress comment

- Violation: `.env.example` documented only `ALPACA_SECRET_KEY=` (fallback) and omitted `ALPACA_API_SECRET=` (primary key read by `alpaca.ts`)
- Rule: docs/API.md — env var documentation must include primary variable names; omitting the primary causes setup errors for new developers
- Context: `alpaca.ts` reads `ALPACA_API_SECRET` first via `?? ALPACA_SECRET_KEY` fallback, but `.env.example` only listed the fallback variable; `ALPACA_API_SECRET=` was added to the example file

- Violation: Two separate `import type` statements from the same `'./types'` module in both `alpaca.ts` and `fmp.ts`
- Rule: FF.md Readability — redundant import declarations from the same module must be merged into one
- Context: Both `alpaca.ts` and `fmp.ts` had `import type { GetBarsOptions, Bar } from './types'` and `import type { MarketDataProvider } from './types'` on separate lines; merged into single import statements

- Violation: Module-level `(createMarketDataProvider as jest.Mock).mockReturnValue(...)` duplicated the identical setup already present in `beforeEach` in `barsApi.test.ts`
- Rule: CONVENTIONS.md Test Rules — mock setup belongs in `beforeEach` only; module-level setup creates hidden duplicate state that is redundant after `beforeEach` runs
- Context: `barsApi.test.ts` called `mockReturnValue` both at module level (lines 22–24) and inside `beforeEach` (lines 38–40); removed the module-level call, leaving `beforeEach` as the single source of mock initialization


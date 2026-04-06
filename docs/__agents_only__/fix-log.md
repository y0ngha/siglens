# Fix Log

## [예시 항목 | 브랜치명 | 날짜]
- Violation: 예시
- Rule: 예시
- Context: 예시

## [Issue #130 Round 2 | refactor/130/server-action-migration | 2026-04-05]
- Violation: Domain functions `buildAnalysisPrompt` and `enrichAnalysisWithConfidence` were mocked with `jest.mock()` in an infrastructure test
- Rule: `src/__tests__/CLAUDE.md` — "Never mock domain functions — test them directly with real inputs"
- Context: `analysisApi.test.ts` mocked the domain analysis functions to control test output; since domain functions are pure with no side effects, they must be called with real inputs and only external dependencies (AI API, file I/O) should be mocked


## [PR #187 Round 2 | refactor/130/server-action-migration | 2026-04-05]
- Violation: `LOOK_AHEAD_COUNT` + `trimmedBars` + `resolvedLimit` fallback in `barsApi.ts` are dead code after `hasMore` was removed
- Rule: MISTAKES.md 9.5 — logic with no practical effect adds noise and obscures intent
- Context: After Server Action migration removed `hasMore` from the response, the code requesting `limit + 1` bars and then slicing back to `limit` served no purpose; simplified to request `limit` directly


## [PR #190 | feat/135/redis-ai-analysis-cache | 2026-04-05]
- Violation: `readonlyToken`이 없을 때 동일한 master 토큰으로 Redis 인스턴스를 두 개 생성해 불필요한 리소스 낭비 발생
- Rule: FF.md Cohesion — 같은 역할을 하는 자원은 중복 생성 없이 재사용해야 함
- Context: `redis.ts`의 `createCacheProvider()`에서 readonlyToken 부재 시 reader와 writer가 동일 설정으로 각각 `new Redis()`를 호출했음; writer를 먼저 생성 후 readonlyToken 유무에 따라 조건부로 reader를 생성하도록 수정

## [PR #191 Round 4 | feat/175/overlay-legend | 2026-04-06]
- Violation: `resolveBarIndex` lacked an upper bound guard for `crosshairIndex >= bars.length`, leaving the function contract incomplete
- Rule: FF.md Predictability — pure utility functions must handle all valid input ranges explicitly so callers cannot receive out-of-bounds results
- Context: `overlayLabelUtils.ts` `resolveBarIndex` guarded for null and negative indices but not for indices beyond array bounds; added `if (crosshairIndex >= bars.length) return bars.length - 1` to complete the guard chain



## [feat/157/fmp-provider | 2026-04-06]
- Violation: `.env.example` documented only `ALPACA_SECRET_KEY=` (fallback) and omitted `ALPACA_API_SECRET=` (primary key read by `alpaca.ts`)
- Rule: docs/API.md — env var documentation must include primary variable names; omitting the primary causes setup errors for new developers
- Context: `alpaca.ts` reads `ALPACA_API_SECRET` first via `?? ALPACA_SECRET_KEY` fallback, but `.env.example` only listed the fallback variable; `ALPACA_API_SECRET=` was added to the example file


## [PR #195 | feat/157/fmp-provider | 2026-04-06]
- Violation: `docs/ARCHITECTURE.md` "최초 진입" 섹션이 HydrationBoundary 패턴 도입 후에도 이전 props 드릴링 방식(`initialBars`, `initialAnalysis`)을 그대로 기술하고 있었음
- Rule: MISTAKES.md TypeScript #11 — Implementation and documentation changes not synchronized
- Context: PR #195에서 `prefetchQuery + HydrationBoundary` 패턴으로 교체했지만 `docs/ARCHITECTURE.md`의 데이터 흐름 다이어그램은 업데이트되지 않아 실제 동작과 불일치; 다이어그램을 HydrationBoundary 패턴에 맞게 수정


## [Issue #172 Round 3 | feat/172/메인-페이지-리디자인-브랜딩-변경 | 2026-04-06]
- Violation: `VolumeChart.tsx`의 bars useEffect가 `bars.length === 0`으로 전환될 때 chart 캔버스를 cleanup하지 않음
- Rule: Lightweight Charts rule 1 — missing chart.remove() cleanup causes duplicate canvas on remount
- Context: `bars` prop이 비어 있는 상태로 전환될 때 이전에 생성된 chart 인스턴스가 DOM에 남아 있어 다음 mount 시 캔버스가 중복될 수 있었음; `bars.length === 0` 분기에서 `chartRef.current.remove()` 후 두 ref를 null로 리셋하도록 수정


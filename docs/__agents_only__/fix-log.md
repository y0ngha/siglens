# Fix Log

## [예시 항목 | 브랜치명 | 날짜]
- Violation: 예시
- Rule: 예시
- Context: 예시

## [PR #190 | feat/135/redis-ai-analysis-cache | 2026-04-05]
- Violation: `readonlyToken`이 없을 때 동일한 master 토큰으로 Redis 인스턴스를 두 개 생성해 불필요한 리소스 낭비 발생
- Rule: FF.md Cohesion — 같은 역할을 하는 자원은 중복 생성 없이 재사용해야 함
- Context: `redis.ts`의 `createCacheProvider()`에서 readonlyToken 부재 시 reader와 writer가 동일 설정으로 각각 `new Redis()`를 호출했음; writer를 먼저 생성 후 readonlyToken 유무에 따라 조건부로 reader를 생성하도록 수정


## [feat/157/fmp-provider | 2026-04-06]
- Violation: `.env.example` documented only `ALPACA_SECRET_KEY=` (fallback) and omitted `ALPACA_API_SECRET=` (primary key read by `alpaca.ts`)
- Rule: docs/API.md — env var documentation must include primary variable names; omitting the primary causes setup errors for new developers
- Context: `alpaca.ts` reads `ALPACA_API_SECRET` first via `?? ALPACA_SECRET_KEY` fallback, but `.env.example` only listed the fallback variable; `ALPACA_API_SECRET=` was added to the example file


## [PR #195 | feat/157/fmp-provider | 2026-04-06]
- Violation: `docs/ARCHITECTURE.md` "최초 진입" 섹션이 HydrationBoundary 패턴 도입 후에도 이전 props 드릴링 방식(`initialBars`, `initialAnalysis`)을 그대로 기술하고 있었음
- Rule: MISTAKES.md TypeScript #11 — Implementation and documentation changes not synchronized
- Context: PR #195에서 `prefetchQuery + HydrationBoundary` 패턴으로 교체했지만 `docs/ARCHITECTURE.md`의 데이터 흐름 다이어그램은 업데이트되지 않아 실제 동작과 불일치; 다이어그램을 HydrationBoundary 패턴에 맞게 수정


## [Issue #172 버그픽스 | feat/172/메인-페이지-리디자인-브랜딩-변경 | 2026-04-06]
- Violation: `SymbolPageClient.tsx`에서 render 중 `setTimeframeChangeCount` + `setPrevTimeframe`을 호출하는 패턴이 React 19 concurrent mode에서 "Cannot update a component (Router) while rendering a different component (ChartContent)" 에러를 유발했음
- Rule: MISTAKES.md Components #5 — Side effects inside setState updater functions; 더 나아가 render 중 setState 자체가 React 19 concurrent mode + startTransition 조합에서 Next.js Router 업데이트 충돌을 일으킬 수 있음
- Context: `useTimeframeChange`의 `startTransition` 내부에서 Suspense가 트리거되는 동안 render-phase setState가 Router context 업데이트와 충돌했음; `timeframeChangeCount` 관리를 `handleTimeframeChange` 이벤트 핸들러 안으로 이동하여 해결

## [fix/bars-null-and-ssr-window-error | 2026-04-06]
- Violation: `panelWidthAtDragStartRef` was initialized by eagerly calling `getDefaultPanelWidth()` while `panelWidth` state used the lazy initializer form; the two initial values diverge if `getDefaultPanelWidth()` returns different results on successive calls
- Rule: CONVENTIONS.md Convention 2-B (Predictability) — useState lazy initializer and useRef initial value must share the same source of truth to prevent divergence
- Context: `usePanelResize.ts` called `getDefaultPanelWidth()` eagerly in `useRef` on line 34; fixed by initializing the ref to `0` since it is always overwritten in `handleDragStart` before being read in `onResize`

## [fix/bars-null-and-ssr-window-error (FMP API spec fix) | 2026-04-06]
- Violation: `console.log(url)` left in `fmp.ts` `getBars()` — debug artifact shipped to infrastructure
- Rule: CONVENTIONS.md — infrastructure functions must be pure side-effect-free except for the single external I/O they are responsible for; debug logging is a prohibited side effect
- Context: `fmp.ts` line 85 had `console.log(url)` after constructing the request URL; removed as part of FMP API spec correction


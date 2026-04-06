# Fix Log

## [예시 항목 | 브랜치명 | 날짜]
- Violation: 예시
- Rule: 예시
- Context: 예시

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

## [PR #205 | fix/204/모바일-UI-캐시-메시지-버그-수정 | 2026-04-07]
- Violation: `cache !== null` 조건을 `cache !== null && force`와 `cache !== null && !force`로 두 블록에 중복 체크
- Rule: MISTAKES.md Coding Paradigm #2 — 동일한 값을 여러 번 계산하거나 조회하는 코드는 단일 블록으로 통합해야 함
- Context: `analyzeAction.ts`에서 캐시 프로바이더 존재 여부를 두 개의 분리된 if 블록에서 각각 확인했음; 단일 `if (cache !== null)` 블록 안에 `if (force) { ... } else { ... }`로 통합하여 중복 제거

## [PR #205 | fix/204/모바일-UI-캐시-메시지-버그-수정 | 2026-04-07]
- Violation: force=true 테스트 케이스에서 `mockCacheSet` 검증 assertion 누락
- Rule: MISTAKES.md Tests #2 — 인프라 파일은 100% 브랜치 커버리지 필수; 모든 코드 경로에 전용 테스트 케이스가 있어야 함
- Context: `analyzeAction.test.ts` force=true 케이스에서 캐시 삭제 후 runAnalysis 결과가 캐시에 다시 저장되는 경로가 검증되지 않았음; `expect(mockCacheSet).toHaveBeenCalledWith(...)` assertion 추가

## [fix/204/모바일-UI-캐시-메시지-버그-수정 | 2026-04-07]
- Violation: `mutationFn` passed `AnalyzeMutationVariables` (which includes `force: boolean`) directly to `analyzeAction`, whose first parameter is typed as `AnalyzeVariables` (no `force` field), causing a TypeScript excess property error
- Rule: CONVENTIONS.md — UI-layer concerns must not bleed into infrastructure-layer types; Server Action parameters must match declared types exactly
- Context: `useAnalysis.ts` passed the full mutation variable object (including `force`) directly to `analyzeAction`; fixed by destructuring `{ force, ...analyzeVars }` and passing `analyzeVars` as the first argument

## [PR #205 | fix/204/모바일-UI-캐시-메시지-버그-수정 | 2026-04-07]
- Violation: `ConfidenceBadge` 컴포넌트에서 `useState`가 derived 변수(`level`, `className`, `label`, `tooltip`) 이후에 선언됨
- Rule: MISTAKES.md Components #2 — Hook 선언 순서는 `useState → useRef → derived variables → useEffect` 순서를 따라야 함
- Context: `AnalysisPanel.tsx`의 `ConfidenceBadge` 함수 컴포넌트에서 `const level = ...` 등 derived 상수를 먼저 선언한 뒤 `useState`를 아래에 배치했음; `useState`를 derived 변수보다 위로 이동하여 수정

## [PR #205 | fix/204/모바일-UI-캐시-메시지-버그-수정 | 2026-04-07]
- Violation: `ChartContent.tsx`(`components/symbol-page/`)에서 `lightweight-charts`의 `IChartApi` 타입을 직접 import하여 `symbol-page` 레이어가 차트 라이브러리에 직접 커플링됨
- Rule: MISTAKES.md Layer Dependencies #3 — `lightweight-charts` import(타입 포함)는 `components/chart/` 내부로 제한됨
- Context: visible range 동기화를 위해 `stockChartRef`, `volumeChartRef`, 콜백 2개가 모두 `IChartApi`에 의존했음; `components/chart/hooks/useChartSync.ts`로 추출하여 `ChartContent.tsx`에서 `IChartApi` import 제거

## [PR #205 | fix/204/모바일-UI-캐시-메시지-버그-수정 | 2026-04-07]
- Violation: TODO 주석으로 명시적 보존이 지시된 `EyeIcon` 컴포넌트가 삭제됨; commented-out 버튼 코드에서 여전히 `EyeIcon`을 참조하고 있어 주석 해제 시 불일치 발생
- Rule: FF.md Predictability — TODO로 유지 의도가 명시된 코드를 삭제하면 향후 주석 해제 시 참조 오류가 발생하여 예측 가능성을 해침
- Context: `AnalysisPanel.tsx`에서 `EyeIcon` 컴포넌트가 제거되었으나 3곳의 commented-out 버튼에서 여전히 `<EyeIcon>`을 참조; 원본 코드를 복원하여 해결

## [fix/bars-null-and-ssr-window-error (FMP API spec fix) | 2026-04-06]
- Violation: `console.log(url)` left in `fmp.ts` `getBars()` — debug artifact shipped to infrastructure
- Rule: CONVENTIONS.md — infrastructure functions must be pure side-effect-free except for the single external I/O they are responsible for; debug logging is a prohibited side effect
- Context: `fmp.ts` line 85 had `console.log(url)` after constructing the request URL; removed as part of FMP API spec correction


# Fix Log

## [PR #216 Round 9 | feat/196/ticker-autocomplete | 2026-04-09]
- Violation: `US_EXCHANGES` 튜플에 `'NYSEArca'`가 포함되어 있으나 테스트에서 누락
- Rule: MISTAKES.md Tests #2 — 인프라 파일 100% 브랜치 커버리지 필수; 허용 거래소 상수의 모든 값이 테스트되어야 함
- Context: `filterUsExchanges` 테스트가 NYSE/NASDAQ/AMEX만 검증하고 NYSEArca를 누락; 4개 모두 포함하도록 수정

## [PR #216 Round 8 | feat/196/ticker-autocomplete | 2026-04-09]
- Violation: `navigate`에서 `setIsClosed(false)`로 설정해 선택 직후 드롭다운이 잠깐 열린 상태로 남을 수 있음
- Rule: CONVENTIONS.md Predictability — 사용자 행동(종목 선택) 완료 후 UI 상태는 즉시 닫힘 상태여야 함
- Context: `debouncedQuery`가 setTimeout으로 비워지기 전까지 `isOpen = !false && hasQuery = true`가 되어 이전 결과가 잠깐 노출; `setIsClosed(true)`로 수정

## [PR #216 Round 7 | feat/196/ticker-autocomplete | 2026-04-09]
- Violation: `{isOpen && ...}` 블록 내부에서 `hasQuery`가 항상 `true`임에도 `&& hasQuery` 조건 유지 (dead code)
- Rule: MISTAKES.md Coding Paradigm #4 — 결과를 변경하지 않는 조건(효과 없는 로직) 제거
- Context: `isOpen = !isClosed && hasQuery`이므로 해당 블록 진입 시 `hasQuery`는 항상 true; `&& hasQuery` 제거

## [PR #216 Round 6 | feat/196/ticker-autocomplete | 2026-04-09]
- Violation: `size?: 'sm' | 'lg'` 인라인 유니온 리터럴 타입을 named type alias로 추출하지 않음
- Rule: CONVENTIONS.md — 2개 이상 리터럴 유니온은 type alias로 추출 필수
- Context: `TickerAutocomplete.tsx`의 Props 인터페이스에 `'sm' | 'lg'` 인라인 선언; `TickerAutocompleteSize` 타입으로 추출

- Violation: 검색 버튼 `onClick` 핸들러만 인라인 익명 함수로 선언, 다른 핸들러와 불일치
- Rule: MISTAKES.md Coding Paradigm #10 — 복잡한 익명 표현식은 named helper로 추출; 동일 컴포넌트 내 핸들러 패턴 일관성 유지
- Context: `navigate`, `handleChange`, `handleKeyDown`은 모두 `useCallback`으로 추출됐으나 검색 버튼 `onClick`만 인라인; `handleSearchClick`으로 추출


## [PR #216 Round 3 | feat/196/ticker-autocomplete | 2026-04-09]
- Violation: 컴포넌트 교체 후 구 구현체 파일(`SymbolSearch.tsx`)이 삭제되지 않고 고아 파일로 남음
- Rule: 코드베이스에 import되지 않는 파일은 데드 코드 — PR에서 교체 시 구 파일 삭제 필수
- Context: `SymbolSearch`가 `TickerAutocomplete`로 교체됐지만 `src/components/search/SymbolSearch.tsx`가 미삭제 상태로 남아 있었음

- Violation: `cache.get()` 호출 시 예외 처리 누락으로 Redis 장애 시 액션 전체 실패
- Rule: CONVENTIONS.md Graceful Degradation — 외부 의존성 호출은 동일 파일 내 다른 패턴과 일관되게 try-catch로 감싸야 함
- Context: `searchTickerAction.ts`의 캐시 조회는 try-catch 없었으나, 동일 파일의 캐시 set과 `koreanNameStore.ts`의 `loadAllEntries()`는 모두 try-catch 처리됨

## [예시 항목 | 브랜치명 | 날짜]
- Violation: 예시
- Rule: 예시
- Context: 예시

## [feat/157/fmp-provider | 2026-04-06]
- Violation: `.env.example` documented only `ALPACA_SECRET_KEY=` (fallback) and omitted `ALPACA_API_SECRET=` (primary key read by `alpaca.ts`)
- Rule: docs/API.md — env var documentation must include primary variable names; omitting the primary causes setup errors for new developers
- Context: `alpaca.ts` reads `ALPACA_API_SECRET` first via `?? ALPACA_SECRET_KEY` fallback, but `.env.example` only listed the fallback variable; `ALPACA_API_SECRET=` was added to the example file



## [Issue #172 버그픽스 | feat/172/메인-페이지-리디자인-브랜딩-변경 | 2026-04-06]
- Violation: `SymbolPageClient.tsx`에서 render 중 `setTimeframeChangeCount` + `setPrevTimeframe`을 호출하는 패턴이 React 19 concurrent mode에서 "Cannot update a component (Router) while rendering a different component (ChartContent)" 에러를 유발했음
- Rule: MISTAKES.md Components #5 — Side effects inside setState updater functions; 더 나아가 render 중 setState 자체가 React 19 concurrent mode + startTransition 조합에서 Next.js Router 업데이트 충돌을 일으킬 수 있음
- Context: `useTimeframeChange`의 `startTransition` 내부에서 Suspense가 트리거되는 동안 render-phase setState가 Router context 업데이트와 충돌했음; `timeframeChangeCount` 관리를 `handleTimeframeChange` 이벤트 핸들러 안으로 이동하여 해결

## [fix/bars-null-and-ssr-window-error | 2026-04-06]
- Violation: `panelWidthAtDragStartRef` was initialized by eagerly calling `getDefaultPanelWidth()` while `panelWidth` state used the lazy initializer form; the two initial values diverge if `getDefaultPanelWidth()` returns different results on successive calls
- Rule: CONVENTIONS.md Convention 2-B (Predictability) — useState lazy initializer and useRef initial value must share the same source of truth to prevent divergence
- Context: `usePanelResize.ts` called `getDefaultPanelWidth()` eagerly in `useRef` on line 34; fixed by initializing the ref to `0` since it is always overwritten in `handleDragStart` before being read in `onResize`

## [fix/204/모바일-UI-캐시-메시지-버그-수정 | 2026-04-07]
- Violation: `mutationFn` passed `AnalyzeMutationVariables` (which includes `force: boolean`) directly to `analyzeAction`, whose first parameter is typed as `AnalyzeVariables` (no `force` field), causing a TypeScript excess property error
- Rule: CONVENTIONS.md — UI-layer concerns must not bleed into infrastructure-layer types; Server Action parameters must match declared types exactly
- Context: `useAnalysis.ts` passed the full mutation variable object (including `force`) directly to `analyzeAction`; fixed by destructuring `{ force, ...analyzeVars }` and passing `analyzeVars` as the first argument

## [PR #205 | fix/204/모바일-UI-캐시-메시지-버그-수정 | 2026-04-07]
- Violation: `ChartContent.tsx`(`components/symbol-page/`)에서 `lightweight-charts`의 `IChartApi` 타입을 직접 import하여 `symbol-page` 레이어가 차트 라이브러리에 직접 커플링됨
- Rule: MISTAKES.md Layer Dependencies #3 — `lightweight-charts` import(타입 포함)는 `components/chart/` 내부로 제한됨
- Context: visible range 동기화를 위해 `stockChartRef`, `volumeChartRef`, 콜백 2개가 모두 `IChartApi`에 의존했음; `components/chart/hooks/useChartSync.ts`로 추출하여 `ChartContent.tsx`에서 `IChartApi` import 제거

## [PR #205 | fix/204/모바일-UI-캐시-메시지-버그-수정 | 2026-04-07]
- Violation: TODO 주석으로 명시적 보존이 지시된 `EyeIcon` 컴포넌트가 삭제됨; commented-out 버튼 코드에서 여전히 `EyeIcon`을 참조하고 있어 주석 해제 시 불일치 발생
- Rule: FF.md Predictability — TODO로 유지 의도가 명시된 코드를 삭제하면 향후 주석 해제 시 참조 오류가 발생하여 예측 가능성을 해침
- Context: `AnalysisPanel.tsx`에서 `EyeIcon` 컴포넌트가 제거되었으나 3곳의 commented-out 버튼에서 여전히 `<EyeIcon>`을 참조; 원본 코드를 복원하여 해결

## [PR #208 | feat/185/seo-최적화 | 2026-04-07]
- Violation: `POPULAR_TICKERS` (비즈니스 도메인 지식)가 `src/lib/seo.ts`에 정의되어 lib 레이어 허용 범위를 벗어남
- Rule: lib/CLAUDE.md — lib 레이어는 utility wrappers, React Query key factories, config constants, chart color constants만 허용; 도메인 비즈니스 상수는 금지
- Context: `POPULAR_TICKERS`는 `sitemap.ts`에서만 사용되는 상수로 lib이 아닌 사용처(sitemap.ts) 내부로 인라인 이동하여 해결

## [PR #208 | feat/185/seo-최적화 | 2026-04-07]
- Violation: JSON-LD `description`이 `generateMetadata`와 `jsonLd` 사이에서 불일치 — jsonLd는 짧은 버전, generateMetadata는 전체 문장 사용
- Rule: FF.md Cohesion — 동일한 도메인 정보(종목 설명)는 코드베이스 전반에서 일관되게 유지되어야 함
- Context: `[symbol]/page.tsx`에서 `generateMetadata`의 description과 `jsonLd.description`이 서로 다른 문자열을 사용했음; jsonLd를 generateMetadata와 동일한 전체 문장으로 통일하여 해결

## [fix/bars-null-and-ssr-window-error (FMP API spec fix) | 2026-04-06]
- Violation: `console.log(url)` left in `fmp.ts` `getBars()` — debug artifact shipped to infrastructure
- Rule: CONVENTIONS.md — infrastructure functions must be pure side-effect-free except for the single external I/O they are responsible for; debug logging is a prohibited side effect
- Context: `fmp.ts` line 85 had `console.log(url)` after constructing the request URL; removed as part of FMP API spec correction


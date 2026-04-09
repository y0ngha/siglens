# Fix Log

## [PR #216 Round 6 | feat/196/ticker-autocomplete | 2026-04-09]
- Violation: `size?: 'sm' | 'lg'` 인라인 유니온 리터럴 타입을 named type alias로 추출하지 않음
- Rule: CONVENTIONS.md — 2개 이상 리터럴 유니온은 type alias로 추출 필수
- Context: `TickerAutocomplete.tsx`의 Props 인터페이스에 `'sm' | 'lg'` 인라인 선언; `TickerAutocompleteSize` 타입으로 추출

- Violation: 검색 버튼 `onClick` 핸들러만 인라인 익명 함수로 선언, 다른 핸들러와 불일치
- Rule: MISTAKES.md Coding Paradigm #10 — 복잡한 익명 표현식은 named helper로 추출; 동일 컴포넌트 내 핸들러 패턴 일관성 유지
- Context: `navigate`, `handleChange`, `handleKeyDown`은 모두 `useCallback`으로 추출됐으나 검색 버튼 `onClick`만 인라인; `handleSearchClick`으로 추출

## [PR #216 Round 5 | feat/196/ticker-autocomplete | 2026-04-09]
- Violation: `searchBySymbol`과 `searchByName`이 URL 엔드포인트만 다르고 동일한 fetch 로직 중복 구현
- Rule: MISTAKES.md Coding Paradigm #1 — 동일한 알고리즘 재구현 금지; 공통 헬퍼 추출 필요
- Context: `fmpTickerApi.ts`의 두 함수가 API 키 검증, URLSearchParams 생성, fetch, 응답 검증, 에러 처리를 모두 중복; `fetchFmpEndpoint('search-symbol'|'search-name', query)` 헬퍼로 추출

- Violation: fire-and-forget `.catch()` 핸들러 브랜치(cache.set 실패, translateAndCache 실패) 테스트 누락
- Rule: MISTAKES.md Tests #2 — infrastructure 파일의 모든 조건부 브랜치(try/catch 포함) 100% 커버리지 필수
- Context: `searchTickerAction.ts`에 두 개의 fire-and-forget `.catch()` 블록이 있었으나 `searchTickerAction.test.ts`에 에러 경로 케이스가 없었음; `mockRejectedValueOnce`로 각각 추가

## [PR #216 Round 4 | feat/196/ticker-autocomplete | 2026-04-09]
- Violation: 모듈 레벨 `let cachedClient` 가변 상태로 싱글턴 캐싱
- Rule: CONVENTIONS.md Functional Programming — 모듈 레벨 가변 변수(`let`) 지양; 생성 비용이 낮은 인스턴스는 매 호출마다 직접 생성
- Context: `koreanTranslator.ts`의 `getClient()` 패턴이 `let cachedClient ??=` 로 캐싱했으나 `GoogleGenerativeAI` 생성 비용이 저렴하므로 함수 내부 인라인으로 변경

## [PR #216 Round 3 | feat/196/ticker-autocomplete | 2026-04-09]
- Violation: 컴포넌트 교체 후 구 구현체 파일(`SymbolSearch.tsx`)이 삭제되지 않고 고아 파일로 남음
- Rule: 코드베이스에 import되지 않는 파일은 데드 코드 — PR에서 교체 시 구 파일 삭제 필수
- Context: `SymbolSearch`가 `TickerAutocomplete`로 교체됐지만 `src/components/search/SymbolSearch.tsx`가 미삭제 상태로 남아 있었음

- Violation: `cache.get()` 호출 시 예외 처리 누락으로 Redis 장애 시 액션 전체 실패
- Rule: CONVENTIONS.md Graceful Degradation — 외부 의존성 호출은 동일 파일 내 다른 패턴과 일관되게 try-catch로 감싸야 함
- Context: `searchTickerAction.ts`의 캐시 조회는 try-catch 없었으나, 동일 파일의 캐시 set과 `koreanNameStore.ts`의 `loadAllEntries()`는 모두 try-catch 처리됨

## [PR #216 Round 1 | feat/196/ticker-autocomplete | 2026-04-09]
- Violation: `getKoreanNames` 반환 타입이 `Record<string, string>`으로 선언되어 누락된 키에 접근 시 `undefined`가 `string`으로 잘못 추론됨
- Rule: TypeScript: 인터페이스 필드 선언이 런타임 동작과 일치해야 함 (MISTAKES.md TypeScript #14 유사 — 런타임에 없을 수 있는 키는 Partial로 선언해야 함)
- Context: `koreanNameStore.getKoreanNames`는 매핑이 없는 심볼 키를 반환 객체에 포함하지 않으므로, 반환 타입을 `Partial<Record<string, string>>`으로 선언해야 `searchTickerAction`의 `koreanNames[result.symbol]`이 `string | undefined`로 올바르게 추론됨

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


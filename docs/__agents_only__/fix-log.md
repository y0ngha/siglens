# Fix Log

## [PR #228 | feat/227/fire-and-forget-waitUntil-migration | 2026-04-10]
- Violation: 프로덕션 코드에서 외부 패키지(@vercel/functions)를 추가했으나 테스트 파일에서 모킹하지 않음
- Rule: CONVENTIONS.md Test Rules — "Mock external dependencies only"; @vercel/functions는 외부 패키지이므로 모킹 대상
- Context: analyzeAction.ts, searchTickerAction.ts, getAssetInfoAction.ts에 waitUntil을 도입하면서 대응 테스트 파일에 jest.mock('@vercel/functions', ...) 추가를 누락

## [PR #222 Round 3 | feat/221/심볼-페이지-회사명-표시 | 2026-04-10]
- Violation: SymbolPageClient.tsx에서 symbol.toUpperCase()를 3회, assetInfo.name !== symbol.toUpperCase() 조건을 2회 반복
- Rule: MISTAKES.md Coding Paradigm #2 — 동일한 값은 한 번만 계산하고 const로 추출
- Context: JSX 렌더 함수 내에서 파생 상수를 추출하지 않고 동일 표현식을 인라인으로 반복

## [PR #222 | feat/221/심볼-페이지-회사명-표시 | 2026-04-10]
- Violation: components/hooks/ 파일에 'use client' 선언 누락
- Rule: CONVENTIONS.md — components/ 아래 커스텀 훅은 무조건 'use client' 선언
- Context: useAssetInfo.ts 작성 시 useTimeframeChange 등 기존 훅 파일에서 패턴을 확인하지 않아 누락

- Violation: 서버 prefetchQuery 키와 클라이언트 훅 키 불일치 (hydration 캐시 미스)
- Rule: React Query Hydration 패턴 — prefetchQuery 키와 useQuery 키가 정확히 일치해야 함
- Context: 서버는 ticker(대문자)로 키를 만들고 클라이언트는 symbol(원본)로 키를 만들어 소문자 URL 진입 시 캐시 미스 발생

## [Issue #221 | feat/221/심볼-페이지-회사명-표시 | 2026-04-10]
- Violation: 새 infrastructure Server Action 파일(getAssetInfoAction.ts) 구현 후 테스트 파일 누락
- Rule: 모든 infrastructure/ 파일은 대응하는 테스트 파일이 있어야 한다 (100% branch coverage target)
- Context: 동일 패턴의 searchTickerAction.test.ts가 존재함에도 getAssetInfoAction.test.ts 작성을 누락

## [PR #220 | feat/219/action-recommendation | 2026-04-10]
- Violation: RESPONSE_LANGUAGE_INSTRUCTION의 "Other text fields" 목록에 새 필드(positionAnalysis, entry, exit, riskReward) 누락
- Rule: Prompt 일관성 — 한국어 작성 지시와 줄바꿈 지시 목록이 동기화되어야 함
- Context: actionRecommendation 필드 추가 시 첫 번째 필드 목록에만 추가하고 두 번째 목록은 누락

- Violation: 모듈 레벨 상수에 인라인 익명 타입 사용
- Rule: 타입 명확성 — 재사용 가능한 타입은 명명 인터페이스로 분리
- Context: ACTION_RECOMMENDATION_FIELDS의 readonly { label: string; key: keyof ActionRecommendation }[]를 명명 인터페이스 ActionRecommendationField로 추출

## [PR #216 Round 11 | feat/196/ticker-autocomplete | 2026-04-10]
- Violation: `docs/ARCHITECTURE.md` 폴더 트리에 신규 `infrastructure/ticker/` 디렉터리 미반영
- Rule: MISTAKES.md TypeScript #11 — 구현 변경 시 문서 동기화 필수
- Context: PR #216에서 `src/infrastructure/ticker/`가 신규 추가됐으나 ARCHITECTURE.md 폴더 트리에 누락

## [PR #216 Round 7 | feat/196/ticker-autocomplete | 2026-04-09]
- Violation: `{isOpen && ...}` 블록 내부에서 `hasQuery`가 항상 `true`임에도 `&& hasQuery` 조건 유지 (dead code)
- Rule: MISTAKES.md Coding Paradigm #4 — 결과를 변경하지 않는 조건(효과 없는 로직) 제거
- Context: `isOpen = !isClosed && hasQuery`이므로 해당 블록 진입 시 `hasQuery`는 항상 true; `&& hasQuery` 제거

## [PR #216 Round 6 | feat/196/ticker-autocomplete | 2026-04-09]
- Violation: `size?: 'sm' | 'lg'` 인라인 유니온 리터럴 타입을 named type alias로 추출하지 않음
- Rule: CONVENTIONS.md — 2개 이상 리터럴 유니온은 type alias로 추출 필수
- Context: `TickerAutocomplete.tsx`의 Props 인터페이스에 `'sm' | 'lg'` 인라인 선언; `TickerAutocompleteSize` 타입으로 추출


## [PR #216 Round 3 | feat/196/ticker-autocomplete | 2026-04-09]
- Violation: 컴포넌트 교체 후 구 구현체 파일(`SymbolSearch.tsx`)이 삭제되지 않고 고아 파일로 남음
- Rule: 코드베이스에 import되지 않는 파일은 데드 코드 — PR에서 교체 시 구 파일 삭제 필수
- Context: `SymbolSearch`가 `TickerAutocomplete`로 교체됐지만 `src/components/search/SymbolSearch.tsx`가 미삭제 상태로 남아 있었음

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


## [PR #205 | fix/204/모바일-UI-캐시-메시지-버그-수정 | 2026-04-07]
- Violation: `ChartContent.tsx`(`components/symbol-page/`)에서 `lightweight-charts`의 `IChartApi` 타입을 직접 import하여 `symbol-page` 레이어가 차트 라이브러리에 직접 커플링됨
- Rule: MISTAKES.md Layer Dependencies #3 — `lightweight-charts` import(타입 포함)는 `components/chart/` 내부로 제한됨
- Context: visible range 동기화를 위해 `stockChartRef`, `volumeChartRef`, 콜백 2개가 모두 `IChartApi`에 의존했음; `components/chart/hooks/useChartSync.ts`로 추출하여 `ChartContent.tsx`에서 `IChartApi` import 제거

## [PR #208 | feat/185/seo-최적화 | 2026-04-07]
- Violation: `POPULAR_TICKERS` (비즈니스 도메인 지식)가 `src/lib/seo.ts`에 정의되어 lib 레이어 허용 범위를 벗어남
- Rule: lib/CLAUDE.md — lib 레이어는 utility wrappers, React Query key factories, config constants, chart color constants만 허용; 도메인 비즈니스 상수는 금지
- Context: `POPULAR_TICKERS`는 `sitemap.ts`에서만 사용되는 상수로 lib이 아닌 사용처(sitemap.ts) 내부로 인라인 이동하여 해결

## [fix/bars-null-and-ssr-window-error (FMP API spec fix) | 2026-04-06]
- Violation: `console.log(url)` left in `fmp.ts` `getBars()` — debug artifact shipped to infrastructure
- Rule: CONVENTIONS.md — infrastructure functions must be pure side-effect-free except for the single external I/O they are responsible for; debug logging is a prohibited side effect
- Context: `fmp.ts` line 85 had `console.log(url)` after constructing the request URL; removed as part of FMP API spec correction

## [PR #229 Round 1 | feat/229/action-recommendation-chart-overlay | 2026-04-10]
- Violation: ActionRecommendationField.key typed as keyof ActionRecommendation included numeric optional fields, causing rec[key] to fail JSX child type validation
- Rule: TypeScript Union Type Safety — string literal unions must be narrowed when accessing object properties that will be used in JSX contexts
- Context: ActionRecommendationField.key was `keyof ActionRecommendation` which included `count?: number` and `updatedAt?: number`; narrowed to `ActionRecommendationTextKey = 'positionAnalysis' | 'entry' | 'exit' | 'riskReward'` to ensure values are text-like for JSX children

- Violation: chartRef (stable RefObject) included in useEffect dependency array for overlay hook
- Rule: MISTAKES.md Components #2 — stable RefObject references should not be in dependency arrays; only include deps that actually change
- Context: useCharacterOverlay hook included chartRef alongside dynamic deps like data; removed to match useChartSync pattern of excluding RefObjects

- Violation: Component props with leading underscore used in component body (e.g., _recommendedAction used as recommendedAction)
- Rule: CONVENTIONS.md Naming — underscore prefix reserved for intentionally-unused destructured parameters; consumed props must not have underscore
- Context: ActionRecommendationField received _recommendedAction but used it in render; removed underscore to indicate the prop is actually consumed

## [PR #242 | feat/236/strategies-스킬-추가 | 2026-04-10]
- Violation: 전략 스킬 frontmatter의 indicators 목록이 본문에서 참조하는 지표(ATR)를 누락
- Rule: 스킬 문서 일관성 — indicators 목록은 본문에서 참조하는 모든 지표를 포함해야 함
- Context: mean-reversion.md가 손절선 규칙에서 2 × ATR을 사용하지만 indicators에 atr 미포함

- Violation: AI Analysis Instructions가 시스템이 실제로 제공하지 않는 데이터 범위(120봉, 다중 시간대)를 전제로 작성됨
- Rule: AI 지침은 시스템의 실제 데이터 제공 범위와 일치해야 함
- Context: wyckoff.md는 120봉 필요하나 RECENT_BARS_COUNT=30; multi-timeframe.md는 3-Tier 분석 전제하나 단일 타임프레임만 제공

## [PR #229 Round 2 | feat/229/action-recommendation-chart-overlay | 2026-04-10]
- Violation: StockChart prop default actionPricesVisible = false contradicted the parent ChartContent's intent (initialized to true). Default off-by-default is misleading when caller explicitly enables the feature.
- Rule: FF.md Readability 1-C — Design intent must be exposed in code; default values must align with component usage context or caller must explicitly pass the value
- Context: ChartContent initializes actionPricesVisible={true}, but StockChart defaulted to false when prop was optional, creating contradiction between declaration and runtime behavior. Fixed by changing StockChart default to true to expose the actual design intent.

## [PR #230 | feat/229/action-recommendation-chart-overlay | 2026-04-10]
- Violation: `#f87171`(actionStopLoss)과 `#4ade80`(actionTakeProfit)은 디자인 시스템에 없는 임의 hex 값 사용
- Rule: DESIGN.md — 상승/하락 색상은 `#26a69a`(bullish) / `#ef5350`(bearish) 고정; 임의 hex 금지
- Context: actionStopLoss에 Tailwind red-400(#f87171), actionTakeProfit에 green-400(#4ade80) 사용; bearish/bullish 시스템 컬러로 교체

- Violation: `ValidatedActionPrices` 인터페이스를 구현 파일(`actionRecommendation.ts`)에 정의
- Rule: ARCHITECTURE.md — 도메인 결과 타입은 `domain/types.ts`에 정의해야 함
- Context: 다른 파일(`StockChart.tsx`, `useActionRecommendationOverlay.ts`)에서도 참조하는 타입을 구현 파일에 배치; `domain/types.ts`로 이동

- Violation: `forEach + push`로 배열을 직접 변경(mutation)
- Rule: MISTAKES.md Coding Paradigm #5 — Array mutation via push/splice; use spread syntax
- Context: `useActionRecommendationOverlay`에서 `lines.push()`로 IPriceLine 배열 직접 변경; `map` + spread(`[...entryLines, ...stopLossLine, ...takeProfitLines]`)로 교체

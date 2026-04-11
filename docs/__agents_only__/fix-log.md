# Fix Log

## [PR #267 Round 2 | feat/256/privacy-terms-pages | 2026-04-11]
- Violation: `Footer.tsx`의 `<div role="note">`에 accessible name(`aria-label`) 누락
- Rule: WAI-ARIA — role="note" 요소에 aria-label로 accessible name을 제공해야 함
- Context: privacy/page.tsx와 terms/page.tsx의 동일 요소에는 aria-label이 있으나 Footer.tsx에만 누락됨

## [PR #222 | feat/221/심볼-페이지-회사명-표시 | 2026-04-10]
- Violation: components/hooks/ 파일에 'use client' 선언 누락
- Rule: CONVENTIONS.md — components/ 아래 커스텀 훅은 무조건 'use client' 선언
- Context: useAssetInfo.ts 작성 시 useTimeframeChange 등 기존 훅 파일에서 패턴을 확인하지 않아 누락

- Violation: 서버 prefetchQuery 키와 클라이언트 훅 키 불일치 (hydration 캐시 미스)
- Rule: React Query Hydration 패턴 — prefetchQuery 키와 useQuery 키가 정확히 일치해야 함
- Context: 서버는 ticker(대문자)로 키를 만들고 클라이언트는 symbol(원본)로 키를 만들어 소문자 URL 진입 시 캐시 미스 발생

## [PR #220 | feat/219/action-recommendation | 2026-04-10]
- Violation: RESPONSE_LANGUAGE_INSTRUCTION의 "Other text fields" 목록에 새 필드(positionAnalysis, entry, exit, riskReward) 누락
- Rule: Prompt 일관성 — 한국어 작성 지시와 줄바꿈 지시 목록이 동기화되어야 함
- Context: actionRecommendation 필드 추가 시 첫 번째 필드 목록에만 추가하고 두 번째 목록은 누락


## [PR #216 Round 3 | feat/196/ticker-autocomplete | 2026-04-09]
- Violation: 컴포넌트 교체 후 구 구현체 파일(`SymbolSearch.tsx`)이 삭제되지 않고 고아 파일로 남음
- Rule: 코드베이스에 import되지 않는 파일은 데드 코드 — PR에서 교체 시 구 파일 삭제 필수
- Context: `SymbolSearch`가 `TickerAutocomplete`로 교체됐지만 `src/components/search/SymbolSearch.tsx`가 미삭제 상태로 남아 있었음

## [Issue #264 | feat/264/모바일-분석패널-바텀시트 | 2026-04-11]
- Violation: `useSyncExternalStore`의 `subscribe`와 `getSnapshot`이 각각 별도로 `window.matchMedia(query)`를 호출해 서로 다른 MediaQueryList 인스턴스를 참조함
- Rule: FF Cohesion 3-B — 같은 리소스는 단일 인스턴스를 공유해야 함; MISTAKES.md Coding Paradigm #2 — 동일 값을 여러 번 계산하지 않는다
- Context: `useMediaQuery.ts` 초기 작성 시 `subscribe`의 `window.matchMedia(query)` 호출과 `getSnapshot`의 `window.matchMedia(query).matches` 호출이 분리됨; `useRef`로 mql 인스턴스를 캐시하고 `getMql()` 헬퍼를 통해 공유하는 방식으로 수정

- Violation: prop으로 전달하는 `readonly` 배열을 컴포넌트 렌더 안에서 `[...CONST]`로 spread해 매 렌더마다 새 배열 참조를 생성
- Rule: MISTAKES.md Coding Paradigm #10 — 렌더마다 재생성되는 파생 값은 모듈 레벨 상수 또는 `useMemo`로 추출한다
- Context: `MobileAnalysisSheet.tsx`에서 `snapPoints={[...MOBILE_SNAP_POINTS]}`가 매 렌더마다 새 배열을 생성; 모듈 레벨의 `SNAP_POINTS_MUTABLE` 상수로 추출하여 해결

## [PR #266 | feat/260-259-258-257-255-254-252-250/seo-accessibility | 2026-04-11]
- Violation: opengraph-image.tsx에서 assetInfo가 null일 때 companyName이 ticker와 동일해져 OG 이미지에 심볼이 중복 노출됨
- Rule: MISTAKES.md Design & Cohesion #5 — 서버와 클라이언트의 동일 비즈니스 규칙 조건이 일치해야 함; buildDisplayName의 `name !== ticker` 가드와 동일 로직 적용 필요
- Context: `opengraph-image.tsx`에서 ticker를 큰 폰트로 표시한 후 companyName도 무조건 표시해 assetInfo 없을 때 동일 문자열이 두 번 렌더링됨; `companyName !== ticker` 조건부 렌더링으로 수정

- Violation: app/ 레이어 async 함수에 명시적 반환 타입 누락
- Rule: CONVENTIONS.md — "Return types must be explicitly declared on domain functions"; app/ 레이어에도 일관성 있게 적용
- Context: `opengraph-image.tsx`의 `Image()` 함수에 `Promise<ImageResponse>` 반환 타입 누락; ImageResponse import 없이 반환 타입 추론에 의존

## [feat/157/fmp-provider | 2026-04-06]
- Violation: `.env.example` documented only `ALPACA_SECRET_KEY=` (fallback) and omitted `ALPACA_API_SECRET=` (primary key read by `alpaca.ts`)
- Rule: docs/API.md — env var documentation must include primary variable names; omitting the primary causes setup errors for new developers
- Context: `alpaca.ts` reads `ALPACA_API_SECRET` first via `?? ALPACA_SECRET_KEY` fallback, but `.env.example` only listed the fallback variable; `ALPACA_API_SECRET=` was added to the example file




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

## [PR #229 Round 2 | feat/229/action-recommendation-chart-overlay | 2026-04-10]
- Violation: StockChart prop default actionPricesVisible = false contradicted the parent ChartContent's intent (initialized to true). Default off-by-default is misleading when caller explicitly enables the feature.
- Rule: FF.md Readability 1-C — Design intent must be exposed in code; default values must align with component usage context or caller must explicitly pass the value
- Context: ChartContent initializes actionPricesVisible={true}, but StockChart defaulted to false when prop was optional, creating contradiction between declaration and runtime behavior. Fixed by changing StockChart default to true to expose the actual design intent.

## [PR #245 | feat/240/9종-보조지표-domain-계산-로직 | 2026-04-11]
- Violation: period 기반 인디케이터 테스트에서 초기 null 범위 케이스 누락
- Rule: CONVENTIONS.md "Required Test Cases for Period-Based Indicators" — 처음 N개 null 케이스 필수
- Context: `keltnerChannel.test.ts`에 '처음 max(emaPeriod-1, atrPeriod)개의 값은 null이다' 테스트 케이스 미포함; 추가 시 리뷰어 제안 수식(max(emaPeriod, atrPeriod))이 구현과 불일치하여 실제 null 구간(emaPeriod-1)으로 수정

## [PR #230 | feat/229/action-recommendation-chart-overlay | 2026-04-10]
- Violation: `#f87171`(actionStopLoss)과 `#4ade80`(actionTakeProfit)은 디자인 시스템에 없는 임의 hex 값 사용
- Rule: DESIGN.md — 상승/하락 색상은 `#26a69a`(bullish) / `#ef5350`(bearish) 고정; 임의 hex 금지
- Context: actionStopLoss에 Tailwind red-400(#f87171), actionTakeProfit에 green-400(#4ade80) 사용; bearish/bullish 시스템 컬러로 교체

- Violation: `ValidatedActionPrices` 인터페이스를 구현 파일(`actionRecommendation.ts`)에 정의
- Rule: ARCHITECTURE.md — 도메인 결과 타입은 `domain/types.ts`에 정의해야 함
- Context: 다른 파일(`StockChart.tsx`, `useActionRecommendationOverlay.ts`)에서도 참조하는 타입을 구현 파일에 배치; `domain/types.ts`로 이동


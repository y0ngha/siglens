# Fix Log

## [PR #285 | fix/281/접근성-UI-UX-가이드라인-위반 | 2026-04-12]
- Violation: 포커스 트랩 컨테이너 자체에 포커스가 있을 때 Shift+Tab 처리 누락 — 컨테이너 div(`tabIndex={-1}`)에 포커스가 있는 상태에서 Shift+Tab 입력 시 트랩을 벗어남
- Rule: WAI-ARIA 포커스 트랩 패턴 — `document.activeElement === ref.current` 케이스도 Shift+Tab 래핑 조건에 포함해야 함
- Context: `useFocusTrap.ts`에서 `first` 요소에만 Shift+Tab 트랩 조건을 두고 컨테이너 자체 포커스는 처리하지 않았음; `ContactDialog`가 열릴 때 `dialogRef.current?.focus()`로 컨테이너에 포커스를 이동시키므로 이 케이스가 실제로 발생

- Violation: 모달 다이얼로그에 최대 높이 제한 없음 — 모바일 가로 모드 등 화면이 작을 때 모달 내용이 잘려 보이지 않을 수 있음
- Rule: UI 레이아웃 안전성 — 모달은 뷰포트 높이를 초과하지 않도록 `max-h` + `overflow-y-auto` 처리 필요
- Context: `ContactDialog` 다이얼로그 div에 높이 제한이 없어 `max-h-[calc(100vh-2rem)] overflow-y-auto` 추가로 해결

## [PR #278 Round 2 | feat/squeeze-momentum-indicator | 2026-04-12]
- Violation: `utils.ts`에서 `const window = values.slice(-period)` — 브라우저 전역 `window` 객체 섀도잉
- Rule: CONVENTIONS.md ESLint no-shadow — `window`, `document`, `location` 등 전역 이름 사용 금지
- Context: `stdDev`와 `linreg` 두 함수 모두 지역 변수명으로 `window`를 사용; `vals`로 변경

## [PR #278 | feat/squeeze-momentum-indicator | 2026-04-12]
- Violation: 계산 정확도 테스트 누락 — period-based 인디케이터임에도 val 부호(양수/음수)만 검증하고 수동 계산 레퍼런스 값과의 일치 여부(toBeCloseTo) 테스트 없음
- Rule: CONVENTIONS.md — Period-Based Indicator 필수 테스트 케이스 표: "첫 번째 값이 명세와 일치한다"
- Context: squeezeMomentum.test.ts에서 상승/하락 부호 검증만 작성하고 PineScript 원본 알고리즘 기준 수동 계산값(9.5)과 toBeCloseTo 검증 누락

- Violation: 워밍업 기간 상수가 실제 첫 번째 유효 출력 인덱스를 과소평가 — 중첩 윈도우 의존성을 고려하지 않음
- Rule: MISTAKES.md Tests #4 — 경계 상수는 소스에서 임포트해야 하며, 수동 계산 시 알고리즘 전체 의존성 체인을 반영해야 함
- Context: MIN_BARS = max(bbLength, kcLength) = 20으로 정의했으나, delta 윈도우가 kcLength 길이의 delta 배열을 필요로 하고 각 delta 값은 kcLength 바가 필요하여 실제 워밍업은 2*kcLength-1 = 39바

- Violation: .map() 외부 변수(let prevVal)로 상태를 누적하여 함수형 패러다임 위반
- Rule: CONVENTIONS.md Coding Paradigm — "순수 함수 선호; 외부 상태 변이 금지"; 이전 계산에 의존하는 상태 기반 로직은 reduce 또는 두 패스 구조로 구현해야 함
- Context: calculateSqueezeMomentum의 bars.map() 내부에서 let prevVal = null 외부 변수를 직접 수정하여 increasing 필드를 계산; 두 패스(intermediate 계산 + increasing 추가)로 분리하여 해결

- Violation: 루프마다 전체 배열 슬라이싱(O(n²)) — sma/stdDev는 내부에서 slice(-period)를 수행하므로 전체 배열 전달 불필요
- Rule: CONVENTIONS.md Performance — 불필요한 배열 복사를 피하고 필요한 윈도우만 전달
- Context: closes.slice(0, i+1) 전달 대신 closes.slice(Math.max(0, i-maxPeriod+1), i+1)로 좁혀 O(n²) → O(n) 개선


## [PR #272 Round 2 | refactor/271/skill-counts-build-time-derivation | 2026-04-11]
- Violation: `indicatorCount` prop이 `SymbolPageClient` → `ChartContent` → `AnalysisPanel`로 드릴링됨 (두 중간 컴포넌트 모두 미사용)
- Rule: FF Coupling 4-D — 중간 컴포넌트가 직접 사용하지 않는 prop을 아래로 전달하는 것은 Props Drilling 위반
- Context: `AnalysisPanel`만 `indicatorCount`를 실제로 사용; `SymbolPageContext` (Provider/hook) 패턴으로 해결

- Violation: `countSkillFiles`에 캐싱 없음 — 페이지 요청마다 skills/ 디렉토리를 다시 스캔
- Rule: App CLAUDE.md — "infrastructure 함수에는 `'use cache'` 디렉티브로 명시적 캐싱 적용"
- Context: `'use cache'` 디렉티브 적용; `cacheComponents: true` 활성화 필요

## [PR #272 | refactor/271/skill-counts-build-time-derivation | 2026-04-11]
- Violation: `countMdFiles`가 `readdir`를 1레벨만 호출하여 비재귀적으로 구현됨
- Rule: 일관성 원칙 — 동일 모듈 내 `collectMdFiles`(재귀 탐색)와 구현 방식이 달라 향후 서브디렉토리 추가 시 카운트 불일치 발생 가능
- Context: `countSkillFiles` 추가 시 `collectMdFiles` 재활용 없이 단순 `readdir` 사용; `collectMdFiles`를 재활용하도록 수정

## [PR #270 | feat/261/차트-dynamic-import-모바일-TTI-개선 | 2026-04-11]
- Violation: dynamic import loading 컴포넌트(`ChartSkeleton`)가 `absolute inset-0`을 사용함에도 래퍼 컨테이너에 `relative` 클래스 누락
- Rule: CSS Positioning — `absolute` 자식이 올바른 영역에 렌더되려면 부모 체인에 `positioned element`(`relative/absolute/fixed/sticky`)가 있어야 함
- Context: StockChart 컨테이너(`<div className="relative flex-3">`)는 기존에 `relative`가 있었으나, VolumeChart 컨테이너는 정적 import에서 로딩 상태가 없어 `relative`가 없었음; dynamic import 전환으로 loading prop이 생기면서 문제가 드러남

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

## [PR #266 | feat/260-259-258-257-255-254-252-250/seo-accessibility | 2026-04-11]
- Violation: app/ 레이어 async 함수에 명시적 반환 타입 누락
- Rule: CONVENTIONS.md — "Return types must be explicitly declared on domain functions"; app/ 레이어에도 일관성 있게 적용
- Context: `opengraph-image.tsx`의 `Image()` 함수에 `Promise<ImageResponse>` 반환 타입 누락; ImageResponse import 없이 반환 타입 추론에 의존

## [feat/157/fmp-provider | 2026-04-06]
- Violation: `.env.example` documented only `ALPACA_SECRET_KEY=` (fallback) and omitted `ALPACA_API_SECRET=` (primary key read by `alpaca.ts`)
- Rule: docs/API.md — env var documentation must include primary variable names; omitting the primary causes setup errors for new developers
- Context: `alpaca.ts` reads `ALPACA_API_SECRET` first via `?? ALPACA_SECRET_KEY` fallback, but `.env.example` only listed the fallback variable; `ALPACA_API_SECRET=` was added to the example file

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

## [PR #230 | feat/229/action-recommendation-chart-overlay | 2026-04-10]
- Violation: `#f87171`(actionStopLoss)과 `#4ade80`(actionTakeProfit)은 디자인 시스템에 없는 임의 hex 값 사용
- Rule: DESIGN.md — 상승/하락 색상은 `#26a69a`(bullish) / `#ef5350`(bearish) 고정; 임의 hex 금지
- Context: actionStopLoss에 Tailwind red-400(#f87171), actionTakeProfit에 green-400(#4ade80) 사용; bearish/bullish 시스템 컬러로 교체

- Violation: `ValidatedActionPrices` 인터페이스를 구현 파일(`actionRecommendation.ts`)에 정의
- Rule: ARCHITECTURE.md — 도메인 결과 타입은 `domain/types.ts`에 정의해야 함
- Context: 다른 파일(`StockChart.tsx`, `useActionRecommendationOverlay.ts`)에서도 참조하는 타입을 구현 파일에 배치; `domain/types.ts`로 이동



# Fix Log

## [PR #331 Round 6 | feat/329/panel-c-sector-signal-discovery | 2026-04-19]
- Violation: useMemo 파생값이 handler 선언 뒤에 위치
- Rule: MISTAKES.md #17 — hook 선언 순서 `useState → useCallback → useMemo(파생값) → handlers → useEffect`
- Context: `SectorSignalPanel.tsx` 에서 `handleSectorChange` / `handleTimeframeChange` 가 `filtered`/`sectorStocks`/`quadrants` useMemo 보다 먼저 선언. useMemo 를 handlers 앞으로 이동

- Violation: radiogroup 키보드 네비게이션에서 DOM 포커스 미이동
- Rule: MISTAKES.md Accessibility #2 — roving tabindex 패턴은 aria-checked 와 DOM focus 동기화 필수
- Context: `TimeframeSelector` 의 Arrow 키 처리가 `onChange` 만 호출하고 실제 포커스 이동 누락. `SectorTabs` 패턴처럼 `querySelectorAll('[role="radio"]')[nextIdx].focus()` 추가

- Violation: bucketedTimestamp 내 unnamed 숫자 리터럴 (10/13/15)
- Rule: MISTAKES.md #15 — business logic constants 는 module-level named constant 로 추출
- Context: `sectorSignalsApi.ts` 의 slice 위치와 15분 버킷 크기를 `ISO_DATE_LENGTH`/`ISO_HOUR_LENGTH`/`FIFTEEN_MIN_BUCKET` 으로 추출

- Violation: useMemo 내 local push 누산기
- Rule: MISTAKES.md #5 — CONVENTIONS.md 예외 (domain 상태머신) 미해당
- Context: `SectorSignalPanel.tsx` quadrants useMemo 를 reduce + spread 패턴으로 재작성. `signalToQuadrantKey` 순수 헬퍼 module-level 추출

## [PR #331 Round 3 | feat/329/panel-c-sector-signal-discovery | 2026-04-19]
- Violation: `stocks.push(result)` 배열 직접 변이
- Rule: MISTAKES.md Coding Paradigm #5 — immutable 패턴 우선 (map + filter)
- Context: `sectorSignalsApi.ts` 의 for-loop 누산기를 `SECTOR_STOCKS.map(...).filter(...)` 함수형 패턴으로 교체

- Violation: `computeBbWidth(lastBB)` 중복 호출
- Rule: MISTAKES.md Coding Paradigm #2 — 동일 입력 중복 계산 금지
- Context: `anticipation.ts computeSqueezeState` 에서 lastBB 의 width 를 루프 진입 전 1회 + 루프 내 i===lastIdx 에서 1회 = 2회 계산. 루프 범위를 `i < lastIdx` 로 변경해 이미 계산한 widthLast 를 push

- Violation: `percentileRank` 가 분산=0 (모든 원소 동일) 케이스에서 0 반환 — 스퀴즈 false-positive 유발 가능
- Rule: defensive numerical handling — degenerate distribution 에서 정책 결정이 필요
- Context: all-equal 입력 시 `below / (len-1) = 0/0` 또는 0 반환으로 "최소값" 으로 분류되어 squeeze 조건 통과. 0.5 중립값 반환으로 수정

## [PR #331 Round 2 | feat/329/panel-c-sector-signal-discovery | 2026-04-19]
- Violation: `as number` 타입 단언을 `!` 로 대체 가능한 상황에서 사용
- Rule: MISTAKES.md TypeScript #7 — `as` 는 null 가능한 경우 `!` 우선 고려
- Context: `anticipation.ts` S/R detector 가 주석에 이미 "null 불가 보장" 명시한 상태에서 `as number` 사용. `!` 로 교체

## [PR #331 | feat/329/panel-c-sector-signal-discovery | 2026-04-19]
- Violation: `components/` .tsx 파일에서 `infrastructure/` 직접 import
- Rule: ARCHITECTURE.md 레이어 의존성 — 컴포넌트 파일은 infrastructure 직접 import 금지 (RSC Server Component 라도 동일 규칙 적용)
- Context: `SectorSignalPanelContainer.tsx` 가 async RSC 라는 명목으로 `getSectorSignals` 를 직접 import 했으나 components/ 폴더 위치만으로 lint 통과해도 규칙 위반. 컨테이너 파일 삭제하고 fetch 를 `app/market/page.tsx` RSC 로 이동

- Violation: 68~74 종목에 대한 Promise.allSettled 병렬 fetch — FMP rate limit 초과 가능
- Rule: API 호출 시 provider rate limit 고려한 concurrency 제한 필수
- Context: `sectorSignalsApi.ts` 가 `Promise.allSettled(SECTOR_STOCKS.map(...))` 로 전체 동시 실행. `fetchInChunks` 헬퍼로 청크 10개씩 순차 처리로 변경

- Violation: 이미 계산된 `indicators.ma[period]` 가 있는데 S/R 감지기에서 `calculateMA` 를 직접 재호출
- Rule: 중복 계산 방지 — indicator bag 우선 사용 후 fallback
- Context: `detectSupportProximityBullish` / `detectResistanceProximityBearish` 가 `_indicators` 를 무시하고 `calculateMA(bars, period)` 만 호출. `indicators.ma[period] ?? calculateMA(bars, period)` 패턴으로 변경

- Violation: `isSqueezePresent` 네이밍이 boolean 반환을 암시하지만 실제로는 객체 반환
- Rule: MISTAKES.md #11 — 함수명은 반환 타입과 일치
- Context: 스퀴즈 상태 객체(lastIdx, pctB, slope)를 반환하므로 `computeSqueezeState` 로 리네임

## [Issue #329 Round 1 | feat/329/panel-c-sector-signal-discovery | 2026-04-19]
- Violation: `rsi1 === null || rsi2 === null || rsi1 === undefined || rsi2 === undefined` 이중 null/undefined 체크
- Rule: FF 2-C (Predictability — expose hidden logic) — `(number | null)[]` 타입이면 out-of-bounds 만 undefined, 의도를 분리해 표기하거나 `== null` 로 통합
- Context: `anticipation.ts detectRegularDivergence` 에서 피벗 인덱스 근거가 있음에도 불필요한 undefined 체크 작성

- Violation: 안정적이지 않은 inline arrow function (`updateUrl`) 을 state handler 에서 호출
- Rule: FF 1-B (Readability — extract implementation detail) — 다른 handler 가 공유 호출할 때는 `useCallback` 으로 식별성 확보
- Context: `SectorSignalPanel.tsx` 의 URL 동기화 로직이 매 렌더 새 함수로 생성되어 `handleSectorChange` / `handleStrictChange` 간 공유 비효율

## [PR #330 Round 3 | feature/issue-328-market-summary-panel | 2026-04-19]
- Violation: infrastructure 파일에 대응하는 테스트 파일 누락
- Rule: CONVENTIONS.md — infrastructure/ 100% coverage 필수
- Context: `getMarketSummaryAction.ts` 신규 생성 시 테스트 파일 미작성

## [PR #330 Round 2 | feature/issue-328-market-summary-panel | 2026-04-19]
- Violation: Lightweight Charts dispose 이후 `unsubscribeCrosshairMove` 직접 호출
- Rule: MISTAKES.md > Lightweight Charts #1 — ref 패턴으로 chart 생존 여부 확인 필요
- Context: `useOverlayLegend.ts` cleanup에서 `chart.unsubscribeCrosshairMove`로 변경하여 ref guard가 제거됨; chart 생성 effect cleanup이 먼저 실행 시 'Object is disposed' 예외 발생 가능

- Violation: derived 상수 이후에 hook 선언
- Rule: MISTAKES.md > Coding Paradigm #16 — 모든 hook은 derived 상수보다 먼저 선언
- Context: `MarketSummaryPanel.tsx`에서 5개 derived 상수 이후 `useBriefing`, `useMemo` 호출; 중간 상수를 인라인으로 이동하여 수정

## [PR #330 | feature/issue-328-market-summary-panel | 2026-04-19]
- Violation: 타입 시스템이 보장하는 필드에 중복 null/truthy 체크
- Rule: MISTAKES.md > Predictability #2 — Conditional checks that duplicate type system guarantees
- Context: `BriefingCard.tsx`에서 `dominantThemes`, `sectorAnalysis`, `leadingSectors` 등 `MarketBriefingResponse`가 보장하는 non-null 필드에 불필요한 `&&` guard 추가

## [PR #315 Round 3 | feat/314/애드센스-배너-광고-구현 | 2026-04-16]
- Violation: layout.tsx에서 `<Script strategy="lazyOnload">`를 `<head>` 내부에 배치
- Rule: Next.js Best Practices — `next/script`는 `<body>` 영역에 배치해야 함; `lazyOnload`는 브라우저 유휴 시점 실행이므로 `<head>` 배치가 의미상 부적절
- Context: AdSense `<Script>`가 `<head>` 블록 안에 있었음; `<body>` 끝으로 이동

## [PR #315 Round 2 | feat/314/애드센스-배너-광고-구현 | 2026-04-16]
- Violation: `shouldShowAd()` 비즈니스 로직 함수가 `lib/`에 배치됨 — lib/CLAUDE.md 범위(유틸리티 래퍼, 설정 상수, 차트 색상) 초과
- Rule: Design & Cohesion — lib/은 순수 유틸리티/설정 상수만; 비즈니스 판단 로직은 사용처에 인라인하거나 domain/으로 이동
- Context: `shouldShowAd`는 AdBanner.tsx 단독 사용이므로 컴포넌트 내 인라인으로 해결; lib/adsense.ts에서 함수 제거

## [PR #315 | feat/314/애드센스-배너-광고-구현 | 2026-04-16]
- Violation: layout.tsx에 `overflow: hidden !important`를 html/body에 전역 적용하여 페이지 스크롤 차단
- Rule: UX & Rendering — 전역 CSS 강제 주입으로 앱 전체 사용성 저해 금지
- Context: AdSense 레이아웃 깨짐을 방지하려는 의도였으나 `overflow: hidden`이 모든 페이지의 스크롤을 차단; `<style dangerouslySetInnerHTML>` 블록 전체 제거

- Violation: AdBanner.tsx 안내 메시지 `<p>`에 `whitespace-nowrap` 적용으로 모바일에서 텍스트 오버플로우 위험
- Rule: Design — 동적 텍스트 콘텐츠에 `whitespace-nowrap` 사용 금지; 자연스러운 줄바꿈 허용
- Context: 긴 한국어 안내 메시지가 작은 화면에서 컨테이너를 넘어 레이아웃 깨짐 유발 가능; 클래스 제거


## [PR #300 | fix/299/mobile-bottom-sheet-native-ux | 2026-04-14]
- Violation: `useEffect` cleanup에서 직접 조작한 DOM 스타일(`transform`, `transition`) 미초기화
- Rule: React useEffect cleanup 원칙 — effect에서 직접 조작한 DOM 상태는 cleanup에서 원상복구해야 vaul 내부 스타일과 충돌 방지
- Context: `MobileAnalysisSheet.tsx` cleanup에서 `drawerEl.style.transform = ''`, `drawerEl.style.transition = ''` 추가

- Violation: null 가드 이전 변수 선언으로 `!` 단언 반복 사용
- Rule: TypeScript narrowing — null 가드 이후 변수를 선언하면 `!` 없이 타입 안전하게 사용 가능
- Context: `scrollEl`·`drawerEl` 선언이 `if (!contentRef.current || ...)` 가드보다 앞에 있어 `scrollEl!`, `drawerEl!` 반복; 가드 이후로 이동

- Violation: `isDragging === true` 진입 후 `deltaY <= 0`일 때 `e.preventDefault()` 미호출로 브라우저 기본 스크롤 발생 가능
- Rule: 터치 이벤트 UX — 드래그 제어 진입 후에는 모든 방향 이동에 대해 `preventDefault()`를 호출해야 함
- Context: `onTouchMove`에서 `deltaY <= 0` early return이 `isDragging` 체크보다 앞에 있어 드래그 중 위로 되돌릴 때 스크롤 허용; 구조 재정렬 + `Math.max(0, deltaY)` 적용

## [PR #294 | feat/key-levels-clustering | 2026-04-13]
- Violation: React key에 `source.price-source.reason` 조합 사용 — 동일 가격·사유 존재 시 중복 가능
- Rule: React — 리스트 렌더링 시 key 고유성 보장
- Context: `ConfluenceInfo`에서 key에 `index` 추가하여 고유성 확보

## [PR #292 | feat/291/cloud-run-worker | 2026-04-12]
- Violation: Worker에서 Promise.all로 result와 status를 동시 저장 — poller가 done 상태를 보고 result가 아직 없을 수 있는 레이스 컨디션
- Rule: 데이터 의존 관계가 있는 Redis 쓰기는 순차 실행
- Context: `worker/src/index.ts`에서 `Promise.all([set result, set status])` → `await set result; await set status`로 순차 실행

## [PR #272 Round 2 | refactor/271/skill-counts-build-time-derivation | 2026-04-11]
- Violation: `indicatorCount` prop이 `SymbolPageClient` → `ChartContent` → `AnalysisPanel`로 드릴링됨 (두 중간 컴포넌트 모두 미사용)
- Rule: FF Coupling 4-D — 중간 컴포넌트가 직접 사용하지 않는 prop을 아래로 전달하는 것은 Props Drilling 위반
- Context: `AnalysisPanel`만 `indicatorCount`를 실제로 사용; `SymbolPageContext` (Provider/hook) 패턴으로 해결

- Violation: `countSkillFiles`에 캐싱 없음 — 페이지 요청마다 skills/ 디렉토리를 다시 스캔
- Rule: App CLAUDE.md — "infrastructure 함수에는 `'use cache'` 디렉티브로 명시적 캐싱 적용"
- Context: `'use cache'` 디렉티브 적용; `cacheComponents: true` 활성화 필요

## [PR #270 | feat/261/차트-dynamic-import-모바일-TTI-개선 | 2026-04-11]
- Violation: dynamic import loading 컴포넌트(`ChartSkeleton`)가 `absolute inset-0`을 사용함에도 래퍼 컨테이너에 `relative` 클래스 누락
- Rule: CSS Positioning — `absolute` 자식이 올바른 영역에 렌더되려면 부모 체인에 `positioned element`(`relative/absolute/fixed/sticky`)가 있어야 함
- Context: StockChart 컨테이너(`<div className="relative flex-3">`)는 기존에 `relative`가 있었으나, VolumeChart 컨테이너는 정적 import에서 로딩 상태가 없어 `relative`가 없었음; dynamic import 전환으로 loading prop이 생기면서 문제가 드러남

## [PR #222 | feat/221/심볼-페이지-회사명-표시 | 2026-04-10]
- Violation: 서버 prefetchQuery 키와 클라이언트 훅 키 불일치 (hydration 캐시 미스)
- Rule: React Query Hydration 패턴 — prefetchQuery 키와 useQuery 키가 정확히 일치해야 함
- Context: 서버는 ticker(대문자)로 키를 만들고 클라이언트는 symbol(원본)로 키를 만들어 소문자 URL 진입 시 캐시 미스 발생

## [PR #216 Round 3 | feat/196/ticker-autocomplete | 2026-04-09]
- Violation: 컴포넌트 교체 후 구 구현체 파일(`SymbolSearch.tsx`)이 삭제되지 않고 고아 파일로 남음
- Rule: 코드베이스에 import되지 않는 파일은 데드 코드 — PR에서 교체 시 구 파일 삭제 필수
- Context: `SymbolSearch`가 `TickerAutocomplete`로 교체됐지만 `src/components/search/SymbolSearch.tsx`가 미삭제 상태로 남아 있었음

## [feat/157/fmp-provider | 2026-04-06]
- Violation: `.env.example` documented only `ALPACA_SECRET_KEY=` (fallback) and omitted `ALPACA_API_SECRET=` (primary key read by `alpaca.ts`)
- Rule: docs/API.md — env var documentation must include primary variable names; omitting the primary causes setup errors for new developers
- Context: `alpaca.ts` reads `ALPACA_API_SECRET` first via `?? ALPACA_SECRET_KEY` fallback, but `.env.example` only listed the fallback variable; `ALPACA_API_SECRET=` was added to the example file

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

- Violation: computeFromDay 반환값이 YYYY-MM-DD 형식 — Alpaca API가 RFC3339 형식 요구
- Rule: Provider pair symmetric rule — Alpaca start 파라미터는 RFC3339 형식 필요
- Context: barsApi.ts의 computeFromDay가 substring(0, 10)만 반환; T00:00:00Z 추가로 RFC3339 호환성 확보 (FMP는 fromDate.substring(0,10)으로 처리하므로 영향 없음)
## [PR #313 | feat/312/타임프레임-변경-시-분석-작업-취소 | 2026-04-15]
- Violation: findIndexMatch 반환 타입을 `ReturnType<typeof filterIndexResults>[number] | undefined`로 표현
- Rule: TypeScript — 재사용 가능하거나 의미를 전달해야 하는 반환 타입은 구조적 유틸리티 타입 대신 명시적 named type으로 표현
- Context: `filterIndexResults`가 `FmpSearchResult[]`를 반환하므로 해당 표현식은 `FmpSearchResult | undefined`와 동일; 명시적 타입 사용이 더 가독성 높음

## [PR #327 | refactor/324/state-machine-인디케이터-O-N-최적화 | 2026-04-18]
- Violation: period-based indicator 테스트에 toBeCloseTo 수치 검증 누락
- Rule: MISTAKES.md Tests #12 — Every period-based indicator test must include toBeCloseTo checks against manually-calculated expected values
- Context: calculateSupertrend 리팩터링 PR에서 기존 테스트가 방향성(up/down) 부등호만 검증하고 실제 계산값을 검증하지 않아 리뷰어에게 Blocker 지적 받음

# Fix Log

## [PR #331 Round 3 | feat/329/panel-c-sector-signal-discovery | 2026-04-19]

- Violation: `percentileRank` 가 분산=0 (모든 원소 동일) 케이스에서 0 반환 — 스퀴즈 false-positive 유발 가능
- Rule: defensive numerical handling — degenerate distribution 에서 정책 결정이 필요
- Context: all-equal 입력 시 `below / (len-1) = 0/0` 또는 0 반환으로 "최소값" 으로 분류되어 squeeze 조건 통과. 0.5 중립값 반환으로 수정

## [PR #331 | feat/329/panel-c-sector-signal-discovery | 2026-04-19]
- Violation: 68~74 종목에 대한 Promise.allSettled 병렬 fetch — FMP rate limit 초과 가능
- Rule: API 호출 시 provider rate limit 고려한 concurrency 제한 필수
- Context: `sectorSignalsApi.ts` 가 `Promise.allSettled(SECTOR_STOCKS.map(...))` 로 전체 동시 실행. `fetchInChunks` 헬퍼로 청크 10개씩 순차 처리로 변경

## [Issue #329 Round 1 | feat/329/panel-c-sector-signal-discovery | 2026-04-19]
- Violation: `rsi1 === null || rsi2 === null || rsi1 === undefined || rsi2 === undefined` 이중 null/undefined 체크
- Rule: FF 2-C (Predictability — expose hidden logic) — `(number | null)[]` 타입이면 out-of-bounds 만 undefined, 의도를 분리해 표기하거나 `== null` 로 통합
- Context: `anticipation.ts detectRegularDivergence` 에서 피벗 인덱스 근거가 있음에도 불필요한 undefined 체크 작성

- Violation: 안정적이지 않은 inline arrow function (`updateUrl`) 을 state handler 에서 호출
- Rule: FF 1-B (Readability — extract implementation detail) — 다른 handler 가 공유 호출할 때는 `useCallback` 으로 식별성 확보
- Context: `SectorSignalPanel.tsx` 의 URL 동기화 로직이 매 렌더 새 함수로 생성되어 `handleSectorChange` / `handleStrictChange` 간 공유 비효율

## [PR #330 Round 2 | feature/issue-328-market-summary-panel | 2026-04-19]
- Violation: Lightweight Charts dispose 이후 `unsubscribeCrosshairMove` 직접 호출
- Rule: MISTAKES.md > Lightweight Charts #1 — ref 패턴으로 chart 생존 여부 확인 필요
- Context: `useOverlayLegend.ts` cleanup에서 `chart.unsubscribeCrosshairMove`로 변경하여 ref guard가 제거됨; chart 생성 effect cleanup이 먼저 실행 시 'Object is disposed' 예외 발생 가능

## [PR #330 | feature/issue-328-market-summary-panel | 2026-04-19]
- Violation: 타입 시스템이 보장하는 필드에 중복 null/truthy 체크
- Rule: MISTAKES.md > Predictability #2 — Conditional checks that duplicate type system guarantees
- Context: `BriefingCard.tsx`에서 `dominantThemes`, `sectorAnalysis`, `leadingSectors` 등 `MarketBriefingResponse`가 보장하는 non-null 필드에 불필요한 `&&` guard 추가

## [PR #315 Round 3 | feat/314/애드센스-배너-광고-구현 | 2026-04-16]
- Violation: layout.tsx에서 `<Script strategy="lazyOnload">`를 `<head>` 내부에 배치
- Rule: Next.js Best Practices — `next/script`는 `<body>` 영역에 배치해야 함; `lazyOnload`는 브라우저 유휴 시점 실행이므로 `<head>` 배치가 의미상 부적절
- Context: AdSense `<Script>`가 `<head>` 블록 안에 있었음; `<body>` 끝으로 이동

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


## [worktree-feat+market-mixed-signal-conflict | 2026-04-20]
- Violation: ConflictInfo interface duplicated across two component files
- Rule: CONVENTIONS.md — shared domain types must have single source of truth
- Context: ConflictInfo defined in both component files; consolidated to conflict-types.ts

- Violation: Complex three-way ternary for variant styling
- Rule: CONVENTIONS.md — complex conditionals should extract to data structures
- Context: Replaced ternary with VARIANT_BORDER and VARIANT_LABEL object maps


## [PR #342 Round 3 | feat/multi-signal-backtest | 2026-04-20]
- Violation: `reconcileBullishActionRecommendation` 도메인 함수 내부에서 `changes.push()` 직접 변이
- Rule: MISTAKES.md #5 / CONVENTIONS.md Immutability — 도메인 레이어는 push/splice 금지
- Context: `const changes: string[] = []` + 조건부 `push` 2개 → `readonly string[] = [...(cond ? [msg] : [])]` 선언형 spread로 변환

- Violation: `'99'` hex alpha 접미사가 두 색상 상수에 중복
- Rule: MISTAKES.md #15 — 반복되는 매직 문자열 상수화
- Context: `RECONCILED_HEX_ALPHA` 모듈 상수로 추출해 두 색상 변수에서 참조 (의미 + 중복 제거)

- Violation: `ReconciledActionLevels.reason` 필드는 툴팁 전용 사유로 정의됐으나 UI가 무시
- Rule: Domain 스키마 의도와 UI 소비 경로 일치 필수
- Context: `AnalysisPanel.ReconciledLevelsBlock` 이 reason을 전달받지 않고 generic prefix만 표시. `RECONCILED_TOOLTIP_PREFIX` + reason을 2줄로 표시하도록 변경

## [PR #342 Round 4 | feat/multi-signal-backtest | 2026-04-20]
- Violation: `generate-backtest.ts`에서 `isValidBullishStopLoss`/`isValidBullishTakeProfit` 재호출 (이미 `resolveBullish*` 결과가 있음)
- Rule: MISTAKES.md #2 — 동일 연산을 같은 함수 내에서 반복 실행 금지
- Context: `slResolved.source === 'ai'`가 `isValidBullishStopLoss`와 의미상 동일. 상단에서 계산된 결과를 재활용하도록 변경 + unused imports 제거

- Violation: `ai-levels.ts`의 `tpResolved.value!` 비-null 단언
- Rule: MISTAKES.md — `!` 단언보다 지역 `const`로 narrowing을 고정해 타입 좁히기를 명시적으로 전파
- Context: `tpWasReconciled` 게이트에도 TS 좁히기 전파가 안 되어 `!` 필요했던 것을, `const tpFallback = tpResolved.value` + `tpWasReconciled && tpFallback !== undefined` 가드로 대체

## [PR #342 Round 5 | feat/multi-signal-backtest | 2026-04-20]
- Violation: `SignalSubsection` ⓘ 버튼이 `title` + `sr-only` 조합만 사용 — 키보드 사용자에게 시각적 툴팁 표시 안 됨
- Rule: MISTAKES.md Accessibility #4 — 인터랙티브 info 아이콘은 `button` + 실제 `role="tooltip"` 렌더 + focus-visible ring 필수
- Context: AnalysisPanel에 구현된 완전한 InfoTooltip(click/pointer/portal/focus-ring)을 `src/components/ui/InfoTooltip.tsx`로 분리해 공통화. SignalSubsection + AnalysisPanel 양쪽에서 재사용. focus-visible:ring-primary-400 기본 포함.

## [PR #342 Round 6 | feat/multi-signal-backtest | 2026-04-20]
- Violation: `InfoTooltip`에 Escape 키 핸들러 부재 — 열린 툴팁을 키보드로 닫을 수 없음
- Rule: WCAG 2.1 SC 1.4.13 (Content on Hover or Focus) — dismissible 요구사항
- Context: `useOnClickOutside`는 포인터만 처리하므로 키보드 사용자 경로가 부재. `useEffect`로 document keydown 리스너 추가해 Escape 시 open=false

- Violation: `InfoTooltip`의 `className` prop이 default 클래스를 완전 교체 → 접근성 필수 클래스(focus-visible ring) 소실 위험
- Rule: 접근성 regression 방지 — override 대신 병합(concat)이 안전
- Context: `cn(DEFAULT_TRIGGER_CLASS, className)` 으로 변경해 추가 커스텀은 허용하되 기본 focus-ring은 항상 유지

- Violation: `InfoTooltip`의 button에 `aria-expanded` 누락 — 토글 disclosure 패턴인데 상태 미노출
- Rule: ARIA — toggle button(disclosure)은 aria-expanded로 상태를 스크린리더에 알려야 함
- Context: `aria-expanded={open}` 속성 추가해 스크린리더 사용자가 Enter/Space 후 상태 변화 감지 가능

- Violation: `useActionRecommendationOverlay.ts` 에 이중 JSDoc 블록 (두 번째 `/** */` 때문에 첫 번째가 orphan)
- Rule: JSDoc 관례 — 하나의 심볼에는 최대 하나의 JSDoc 블록만 연결
- Context: 두 JSDoc 블록을 `//` 섹션 주석으로 통합해 orphan 제거

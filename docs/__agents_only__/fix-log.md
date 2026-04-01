# Fix Log

## [Issue #79 | fix/79/프롬프트-스키마-누락-필드-추가-에러-로깅-개선 | 2026-03-29]
- Violation: `!bars` 검증이 빈 배열 `[]`을 유효한 입력으로 통과시킴
- Rule: CONVENTIONS.md — 빈 bars 배열은 의미 있는 분석 결과를 기대할 수 없으므로, `!bars` 단독 검증으로는 caller에게 명확한 에러 응답을 줄 수 없음
- Context: `route.ts`의 입력 검증에서 `!bars`만으로는 빈 배열을 거르지 못하여, `bars.length === 0` 조건을 추가하여 빈 bars도 400 응답으로 처리

## [Issue #89 | feat/89/보조지표-show-hide-토글-UI | 2026-03-31]
- Violation: `IndicatorToolbarProps`에 `xyzVisible + onXYZToggle` 플랫 props 12개가 나열되어 새 지표 추가 시 props 2개씩 증가
- Rule: FF.md Coupling 4-A — 함께 변경되는 props는 묶어야 한다; 새 지표마다 interface와 호출 사이트 양쪽을 수정해야 하는 tight coupling
- Context: `bollingerVisible/onBollingerToggle` 등 4쌍을 `IndicatorToggleGroup { visible, onToggle }` 구조로 묶어 `bollinger`, `macd`, `rsi`, `dmi` 6개 props로 감소; `StockChart.tsx` 호출 사이트 동시 업데이트

## [PR #99 | feat/89/보조지표-show-hide-토글-UI | 2026-03-31]
- Violation: `IndicatorToolbar.tsx`에서 `getPeriodColor(period)` 반환값을 `style` prop으로 적용하는 코드에 허용 사유 주석이 없어 DESIGN.md 인라인 스타일 금지 규칙 위반 여부가 불명확했음
- Rule: DESIGN.md — 인라인 스타일은 금지; 단 런타임에 결정되는 동적 도메인 색상 상수(CHART_COLORS)는 Tailwind 임의값으로 표현 불가능하므로 예외 허용, 주석으로 명시 필요
- Context: `getPeriodColor`는 `CHART_COLORS` 기반 상수를 반환하는 런타임 동적 색상으로, Tailwind 임의값 문법으로 대체 불가능함을 주석으로 명시하여 의도를 문서화

## [PR #112 | feat/109/AI-분석-패널-너비-드래그-조절 | 2026-03-31]
- Violation: `usePanelResize.ts`에서 `React.MouseEvent` 타입을 사용하면서 `React` import가 누락되어 TypeScript 컴파일 오류 발생
- Rule: TypeScript — 사용하는 모든 타입의 import가 명시되어야 한다
- Context: `import type React from 'react'`를 추가하고, `handleDragStart`가 `panelWidth` state에 의존하여 불필요하게 재생성되는 문제를 `panelWidthRef` + `useEffect` 패턴으로 해결하여 함수를 안정화

## [PR #112 | feat/109/AI-분석-패널-너비-드래그-조절 | review fix 4 | 2026-03-31]
- Violation: focusable `role="separator"` 드래그 핸들에 `onKeyDown` 핸들러가 없어 키보드 사용자가 패널 너비를 조절할 수 없는 접근성 미구현
- Rule: WAI-ARIA spec — focusable separator must support ArrowLeft/ArrowRight key adjustment
- Context: `usePanelResize`에 `handleKeyDown` 핸들러를 추가하여 ArrowLeft/ArrowRight로 `KEYBOARD_RESIZE_STEP(10px)` 단위 너비 조절 지원; `ChartContent.tsx` 드래그 핸들에 `onKeyDown={handleKeyDown}` 연결

## [PR #112 | feat/109/AI-분석-패널-너비-드래그-조절 | review fix 6 | 2026-03-31]
- Violation: `usePanelResize.ts`에서 `useRef(panelWidthAtDragStartRef)`가 `useState(panelWidth)`보다 앞에 선언되어 CONVENTIONS.md Custom Hook Declaration Order 위반
- Rule: CONVENTIONS.md Custom Hook Declaration Order — useState (1) must precede useRef (2) inside custom hooks
- Context: `usePanelResize` 훅 내부에서 `const panelWidthAtDragStartRef = useRef(...)` 선언이 `const [panelWidth, setPanelWidth] = useState(...)` 선언보다 앞에 위치해 있었음; 순서를 교체하여 useState → useRef 순으로 수정

## [PR #129 | feat/113/캔들-패턴-차트-시각적-표시 | 2026-04-01]
- Violation: 패턴 trend 분류 로직(BULLISH/BEARISH Sets, getSinglePatternTrend 등)이 components 레이어에 위치하여 테스트 불가 및 재사용 불가
- Rule: ARCHITECTURE.md Layer Rules — UI 비의존 순수 비즈니스 로직은 domain 레이어에 위치해야 함
- Context: `domain/analysis/candle-trend.ts`로 분리하여 100% 테스트 커버리지 대상으로 전환; components에서는 domain import로 사용

## [PR #129 | feat/113/캔들-패턴-차트-시각적-표시 | 2026-04-01]
- Violation: 3봉 패턴 감지 시 detection window 시작 부분에서 이전 데이터 부족으로 미감지 가능
- Rule: domain/CLAUDE.md Candle Pattern Detection — multi-candle 패턴은 2~3봉이 필요하므로 충분한 데이터 확보 필요
- Context: `detectCandlePatternEntries`에서 `CANDLE_PATTERN_DETECTION_BARS + MULTI_CANDLE_PATTERN_BUFFER(2)`개 데이터를 확보하여 감지, 결과는 마지막 15봉에 대해서만 반환

## [PR #129 | feat/113/캔들-패턴-차트-시각적-표시 | 2026-04-01]
- Violation: useEffect에서 plugin 초기화(createSeriesMarkers)와 데이터 동기화(setMarkers)가 혼합되어 있고, cleanup이 별도 useEffect로 분리
- Rule: CONVENTIONS.md Custom Hook Rules — instance creation/destruction([])와 data synchronization([deps])을 별도 useEffect로 분리해야 함
- Context: `useCandlePatternMarkers.ts`에서 초기화+cleanup을 `useEffect([seriesRef])`로, 데이터 동기화를 `useEffect([markers, isVisible])`로 분리

## [PR #129 | feat/113/캔들-패턴-차트-시각적-표시 | 2026-04-01]
- Violation: `extendedBars.forEach((_, i) => {...})`에서 비단순 로직을 forEach로 처리
- Rule: MISTAKES.md 1 예외 조항 — 비단순(non-trivial) 로직은 for...of 사용 권장
- Context: `detectCandlePatternEntries`의 다봉 패턴 감지 루프와 involvedIndices 수집 루프를 `for...of`로 변경

## [PR #129 | feat/113/캔들-패턴-차트-시각적-표시 | 2026-04-01]
- Violation: 다봉 패턴 제외 테스트에서 동일한 봉 데이터(makeBar)로 생성하여 다봉 패턴이 감지되지 않아 forEach assertion이 실행되지 않음
- Rule: MISTAKES.md Tests Rule 11.7 — 보장된 테스트 데이터에 대한 무조건적 assertion 필요
- Context: `candle-detection.test.ts`에서 makeEngulfingPair로 bullish_engulfing 감지를 보장하고 `expect(multiEntries.length).toBeGreaterThanOrEqual(1)` 무조건 assertion 추가

## [PR #129 | feat/113/캔들-패턴-차트-시각적-표시 | 2026-04-01]
- Violation: `PromptCandlePatternEntry.patternType`에 인라인 union literal `'single' | 'multi'` 사용
- Rule: MISTAKES.md TypeScript Rule 5 — 2개 이상 멤버의 union literal은 별도 type alias로 추출
- Context: `prompt.ts`에서 `type PatternEntryType = 'single' | 'multi'`로 추출하여 interface 필드에서 참조

## [Issue #132 | fix/132/pane-indicator-label-표시-수정 | 2026-04-01]
- Violation: `PaneLabelConfig`, `PaneSubLabel` 타입이 hooks/ 파일에서 정의되고 utils/에서 import하여 역방향 의존성 발생
- Rule: CONVENTIONS.md Component Folder Structure — hooks/는 React hook 파일, utils/는 순수 함수; utils가 hooks를 import하면 안 됨
- Context: `chart/types.ts`로 공유 타입을 추출하여 hooks/와 utils/ 모두 types.ts에서 import하도록 변경

## [Issue #132 | fix/132/pane-indicator-label-표시-수정 | 2026-04-01]
- Violation: MACD sub-label에 'Signal', 'Histogram' 하드코딩 문자열 사용
- Rule: MISTAKES.md TypeScript #6 — 구현 코드의 하드코딩 리터럴은 상수로 추출
- Context: `paneLabelUtils.ts`에 `MACD_SIGNAL_LABEL`, `MACD_HISTOGRAM_LABEL` 상수로 추출

## [Issue #132 | fix/132/pane-indicator-동적-index-계산 | 2026-04-01]
- Violation: `INACTIVE_PANE_INDEX = -1`이 StockChart.tsx, paneLabelUtils.ts, 테스트 파일 3곳에서 각각 별도 정의
- Rule: MISTAKES.md #0 / FF.md Cohesion 3-B — 동일 값이 여러 위치에 정의되면 단일 상수로 추출해야 함
- Context: `components/chart/constants.ts`에 `INACTIVE_PANE_INDEX`를 단일 정의하고, StockChart.tsx, paneLabelUtils.ts, paneLabelUtils.test.ts에서 import하도록 변경


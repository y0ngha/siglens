# Fix Log

## [Issue #79 | fix/79/프롬프트-스키마-누락-필드-추가-에러-로깅-개선 | 2026-03-29]
- Violation: `!bars` 검증이 빈 배열 `[]`을 유효한 입력으로 통과시킴
- Rule: CONVENTIONS.md — 빈 bars 배열은 의미 있는 분석 결과를 기대할 수 없으므로, `!bars` 단독 검증으로는 caller에게 명확한 에러 응답을 줄 수 없음
- Context: `route.ts`의 입력 검증에서 `!bars`만으로는 빈 배열을 거르지 못하여, `bars.length === 0` 조건을 추가하여 빈 bars도 400 응답으로 처리

## [PR #82 | feat/81/gemini-ai-provider-지원-추가 | 2026-03-30]
- Violation: `process.env.AI_PROVIDER ?? DEFAULT_AI_PROVIDER`로 기본값을 먼저 할당한 뒤 `in` 연산자로 재검증하여 `undefined`인 경우를 올바르게 처리하지 못함
- Rule: CONVENTIONS.md Coding Paradigm — 중복 로직을 제거하고 단일 확인으로 단순화해야 함
- Context: `factory.ts`의 `createAIProvider`에서 `raw`에 기본값을 먼저 할당하면 `undefined` 케이스가 `in` 연산자 이전에 이미 처리되어 논리가 불명확해짐; `raw && raw in AI_PROVIDER_MAP` 패턴으로 단순화

## [Issue #89 | feat/89/보조지표-show-hide-토글-UI | 2026-03-31]
- Violation: `IndicatorToolbarProps`에 `xyzVisible + onXYZToggle` 플랫 props 12개가 나열되어 새 지표 추가 시 props 2개씩 증가
- Rule: FF.md Coupling 4-A — 함께 변경되는 props는 묶어야 한다; 새 지표마다 interface와 호출 사이트 양쪽을 수정해야 하는 tight coupling
- Context: `bollingerVisible/onBollingerToggle` 등 4쌍을 `IndicatorToggleGroup { visible, onToggle }` 구조로 묶어 `bollinger`, `macd`, `rsi`, `dmi` 6개 props로 감소; `StockChart.tsx` 호출 사이트 동시 업데이트

## [PR #99 | feat/89/보조지표-show-hide-토글-UI | 2026-03-31]
- Violation: `IndicatorToolbar.tsx`에서 `getPeriodColor(period)` 반환값을 `style` prop으로 적용하는 코드에 허용 사유 주석이 없어 DESIGN.md 인라인 스타일 금지 규칙 위반 여부가 불명확했음
- Rule: DESIGN.md — 인라인 스타일은 금지; 단 런타임에 결정되는 동적 도메인 색상 상수(CHART_COLORS)는 Tailwind 임의값으로 표현 불가능하므로 예외 허용, 주석으로 명시 필요
- Context: `getPeriodColor`는 `CHART_COLORS` 기반 상수를 반환하는 런타임 동적 색상으로, Tailwind 임의값 문법으로 대체 불가능함을 주석으로 명시하여 의도를 문서화

## [PR #105 | refactor/104/AI-프롬프트-문자열-영어로-변환 | 2026-03-31]
- Violation: Test file structure exceeded 3 levels (4 levels: describe('prompt') > describe('buildAnalysisPrompt') > describe(context) > it(behavior))
- Rule: MISTAKES.md Test Rule 9 — test file must use exactly 3 levels: describe(subject) > describe(context) > it(behavior)
- Context: In `src/__tests__/domain/analysis/prompt.test.ts`, the `describe('buildAnalysisPrompt')` wrapper was an unnecessary intermediate layer; removed it so all context describe blocks are directly under `describe('prompt')`

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
- Violation: `multiEntries` 생성 시 `findIndex`를 별도 호출하여 O(N^2) 비효율
- Rule: FF.md Readability 1-A — 이미 알고 있는 인덱스를 재계산하지 않아야 함
- Context: `detectCandlePatternEntries`에서 multi 패턴 감지 시 인덱스를 `multiEntryMap`에 함께 수집하여 별도 findIndex 호출 제거

## [PR #129 | feat/113/캔들-패턴-차트-시각적-표시 | 2026-04-01]
- Violation: candle-detection.ts와 prompt.ts 간 순환 의존성 — CANDLE_PATTERN_DETECTION_BARS를 prompt.ts에서 정의하고 candle-detection.ts에서 import, 반대로 prompt.ts가 candle-detection.ts에서 import
- Rule: FF.md Coupling 4-A — 순환 의존성은 모듈 초기화 순서를 취약하게 만들고 결합도를 높임
- Context: CANDLE_PATTERN_DETECTION_BARS를 candle-detection.ts로 이동하여 순환 의존 해소; prompt.ts와 테스트 파일의 import 경로를 candle-detection으로 변경

## [PR #129 | feat/113/캔들-패턴-차트-시각적-표시 | 2026-04-01]
- Violation: CandlePatternEntry의 singlePattern/multiPattern이 nullable로 정의되어 non-null assertion(!) 사용 필요
- Rule: FF.md Predictability 2-B — discriminated union으로 타입을 구조화하면 타입 가드만으로 안전하게 접근 가능
- Context: CandlePatternEntry를 SingleCandlePatternEntry | MultiCandlePatternEntry discriminated union으로 재구성하여 patternType 분기 시 ! 없이 타입 안전 접근 보장

## [PR #129 | feat/113/캔들-패턴-차트-시각적-표시 | 2026-04-01]
- Violation: `selectLastCandlePatternEntries`에 대한 직접 단위 테스트 누락
- Rule: __tests__/CLAUDE.md — 커버리지 타겟 100%; export된 domain 함수는 edge cases 포함 테스트 필수
- Context: `candle-detection.test.ts`에 `selectLastCandlePatternEntries` 테스트 describe 블록 추가; empty entries, single-only, multi-only, mixed entries, boundary(barIndex 0) 케이스 커버

## [PR #129 | feat/113/캔들-패턴-차트-시각적-표시 | 2026-04-01]
- Violation: 테스트 구조가 `describe(module) → describe(function) → it(behavior)` 2단계로 3레벨 미달
- Rule: MISTAKES.md Test Rule 6 / __tests__/CLAUDE.md — 테스트는 반드시 `describe(module) → describe(function) → describe(context) → it(behavior)` 3단계 describe + it 구조를 따라야 함
- Context: `candle-trend.test.ts`의 `getSinglePatternTrend`, `getMultiPatternTrend`, `EXCLUDED_SINGLE_PATTERNS` 세 describe 블록 모두 context describe 레벨 추가

## [PR #129 | feat/113/캔들-패턴-차트-시각적-표시 | 2026-04-01]
- Violation: useEffect에서 plugin 초기화(createSeriesMarkers)와 데이터 동기화(setMarkers)가 혼합되어 있고, cleanup이 별도 useEffect로 분리
- Rule: CONVENTIONS.md Custom Hook Rules — instance creation/destruction([])와 data synchronization([deps])을 별도 useEffect로 분리해야 함
- Context: `useCandlePatternMarkers.ts`에서 초기화+cleanup을 `useEffect([seriesRef])`로, 데이터 동기화를 `useEffect([markers, isVisible])`로 분리

## [PR #129 | feat/113/캔들-패턴-차트-시각적-표시 | 2026-04-01]
- Violation: `getDetectionBars`에서 `Math.min(bars.length, CANDLE_PATTERN_DETECTION_BARS)`가 실질적 효과 없음
- Rule: MISTAKES.md 9.5 — 실질적 효과가 없는 로직은 노이즈를 추가하고 의도를 모호하게 만듦
- Context: `Array.slice(-n)`은 `n > array.length`일 때 자동으로 전체 배열을 반환하므로 `Math.min` 불필요; `bars.slice(-CANDLE_PATTERN_DETECTION_BARS)`로 단순화

## [PR #129 | feat/113/캔들-패턴-차트-시각적-표시 | 2026-04-01]
- Violation: `extendedBars.forEach((_, i) => {...})`에서 비단순 로직을 forEach로 처리
- Rule: MISTAKES.md 1 예외 조항 — 비단순(non-trivial) 로직은 for...of 사용 권장
- Context: `detectCandlePatternEntries`의 다봉 패턴 감지 루프와 involvedIndices 수집 루프를 `for...of`로 변경

## [PR #129 | feat/113/캔들-패턴-차트-시각적-표시 | 2026-04-01]
- Violation: `selectLastCandlePatternEntries` 테스트에서 describe 설명이 관련 봉의 단봉 패턴 검증을 약속하지만 assertion 미포함
- Rule: FF.md Predictability 2-C — describe 설명이 약속하는 동작을 assertion에서 모두 검증해야 함
- Context: 다봉 패턴만 존재 시 관련 봉의 단봉 패턴(singleResults) 존재 여부와 barIndex 범위를 검증하는 assertion 추가

## [PR #129 | feat/113/캔들-패턴-차트-시각적-표시 | 2026-04-01]
- Violation: 다봉 패턴 제외 테스트에서 동일한 봉 데이터(makeBar)로 생성하여 다봉 패턴이 감지되지 않아 forEach assertion이 실행되지 않음
- Rule: MISTAKES.md Tests Rule 11.7 — 보장된 테스트 데이터에 대한 무조건적 assertion 필요
- Context: `candle-detection.test.ts`에서 makeEngulfingPair로 bullish_engulfing 감지를 보장하고 `expect(multiEntries.length).toBeGreaterThanOrEqual(1)` 무조건 assertion 추가

## [PR #129 | feat/113/캔들-패턴-차트-시각적-표시 | 2026-04-01]
- Violation: `selectLastCandlePatternEntries`의 `involvedSingles` 필터가 실질적으로 빈 배열만 반환하는 dead code path
- Rule: MISTAKES.md 9.5 — 실질적 효과가 없는 로직은 노이즈를 추가하고 의도를 모호하게 만듦
- Context: `detectCandlePatternEntries`가 이미 다봉 관련 봉의 단봉을 제외하므로 `allEntries` 매개변수와 `involvedSingles` 필터를 제거하고 함수를 단순화; 모든 caller와 테스트 업데이트

## [PR #129 | feat/113/캔들-패턴-차트-시각적-표시 | 2026-04-01]
- Violation: `prompt.test.ts`의 테스트 설명 '다봉 패턴이 있을 때 해당 봉의 단봉 패턴도 함께 포함된다'가 실제 assertion과 불일치
- Rule: FF.md Predictability 2-C — 테스트 설명이 약속하는 동작을 assertion에서 검증해야 함
- Context: 테스트 설명을 실제 동작에 맞게 수정하고 단봉 패턴이 포함되지 않음을 검증하는 assertion 추가


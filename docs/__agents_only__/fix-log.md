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

## [Issue #91 | feat/91/candle-pattern-summary-ui | 2026-03-31]
- Violation: `CandlePatternAccordionItem`에서 `CANDLE_PATTERN_LABELS as Record<string, string>` 타입 단언을 사용해 레이블 맵의 타입 안전성 우회
- Rule: CONVENTIONS.md — `as` type assertions are discouraged; use type guards or typed helpers instead
- Context: `AnalysisPanel.tsx`의 `patternLabel` 계산에서 `CandlePattern` 또는 `MultiCandlePattern` 중 어느 것인지 불명확한 `string` 패턴명을 처리하기 위해 `as` 단언을 사용함; `candle-labels.ts`에 `findCandlePatternLabel(patternName: string)` 헬퍼를 추가하여 `in` 연산자 기반 타입 가드로 안전하게 처리

## [PR #105 | refactor/104/AI-프롬프트-문자열-영어로-변환 | 2026-03-31]
- Violation: Using `getMultiCandlePatternLabel(multiPattern)` instead of the identifier `multiPattern` directly in English prompt string
- Rule: Prompt language consistency — all English prompt strings should use identifiers directly rather than calling a label function that may return different language labels
- Context: In `src/domain/analysis/prompt.ts` line 96, the multi-candle pattern was displayed using `getMultiCandlePatternLabel()` which is inconsistent with the all-English prompt approach; replaced with direct use of `multiPattern` identifier and removed the now-unused import

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

## [PR #112 | feat/109/AI-분석-패널-너비-드래그-조절 | review fix 7 | 2026-03-31]
- Violation: `ChartContent.tsx`의 `aside` style prop에서 `--panel-width` CSS 커스텀 프로퍼티를 인라인 스타일로 사용하면서 예외 사유 주석이 누락됨
- Rule: MISTAKES.md Components Rule 14 — 인라인 스타일은 원칙적으로 금지되며, 런타임에 결정되는 동적 값으로 불가피하게 사용할 경우 반드시 주석으로 그 이유를 명시해야 한다
- Context: `panelWidth`는 드래그 상태에서 런타임에 결정되어 정적 Tailwind 클래스로 표현 불가능하다는 설명 주석을 인라인 스타일 객체 내에 추가

## [PR #116 | fix/114/캔들-패턴-감지-범위-최근-15봉으로-제한 | 2026-04-01]
- Violation: 다봉 패턴 감지 테스트 2건에서 `if (result.includes('Multi-candle pattern:'))` 조건부 assertion 패턴을 사용하여 패턴이 미감지될 경우 테스트가 assertion 없이 통과됨
- Rule: FF.md Predictability 2-C, CONVENTIONS.md 테스트 규칙 — 각 it 블록은 정확히 하나의 동작을 무조건적으로 검증해야 함
- Context: `prompt.test.ts`의 두 다봉 패턴 테스트에서 사용한 봉 데이터(음봉→양봉 장악형 조건 충족)는 반드시 `bullish_engulfing`을 감지하므로 if 가드 없이 직접 assertion 가능; if 조건문 제거 후 unconditional `expect(result).toMatch(...)` 패턴으로 변경

## [PR #116 | fix/114/캔들-패턴-감지-범위-최근-15봉으로-제한 | review fix | 2026-04-01]
- Violation: `buildCandlePatternEntries`에서 `singleEntries`와 `multiEntries`를 단순 concat하여 같은 `barsAgo` 위치에 단봉+다봉 패턴이 동시에 출력됨
- Rule: domain/CLAUDE.md Pattern Priority — 같은 봉에 다봉 패턴이 감지되면 단봉 패턴은 출력하지 않아야 한다
- Context: `prompt.ts`의 `buildCandlePatternEntries`에서 `multiBarPositions` Set을 생성하여 다봉 패턴이 있는 `barsAgo` 위치의 단봉 패턴을 필터링하도록 수정

## [PR #116 | fix/114/캔들-패턴-감지-범위-최근-15봉으로-제한 | review fix | 2026-04-01]
- Violation: `type CandlePatternEntry = { ... }` 객체 형상을 type alias로 선언
- Rule: CONVENTIONS.md TypeScript Rules — 객체 형상(object shape)은 `interface`로 선언해야 한다
- Context: `prompt.ts`의 `CandlePatternEntry`가 `type` 키워드로 선언되어 있었음; `interface CandlePatternEntry`로 변경

## [PR #116 | fix/114/캔들-패턴-감지-범위-최근-15봉으로-제한 | review fix 2 | 2026-04-01]
- Violation: `buildCandlePatternEntries`의 `multiEntries` 생성 후 `.filter(findIndex === idx)` 중복 제거 필터가 dead code로 존재
- Rule: FF.md Readability 1-B — 실질적 효과가 없는 불필요한 로직 레이어는 노이즈를 추가하고 코드 파악을 어렵게 만든다
- Context: `flatMap`에서 `barsAgo = totalBars - 1 - i`로 각 엔트리의 `barsAgo` 값이 고유하게 생성되므로 동일한 `(patternName, barsAgo)` 쌍이 중복될 수 없음; `.filter()` 블록 전체 제거

## [PR #116 | fix/114/캔들-패턴-감지-범위-최근-15봉으로-제한 | review fix 2 | 2026-04-01]
- Violation: `'여러 봉에서 감지된 패턴이 모두 포함된다'` 테스트에서 `toBeGreaterThanOrEqual(1)` assertion이 불충분하여 "최소 1개"만 검증
- Rule: FF.md Predictability 2-C, CONVENTIONS.md Test Rules — 테스트 설명("모두 포함")과 실제 assertion이 일치해야 한다
- Context: 테스트 데이터(음봉 prevBar + 장악형 양봉 currBar)는 반드시 2개 엔트리(barsAgo=1 단봉 + barsAgo=0 다봉)를 생성하므로 `toBeGreaterThanOrEqual(2)`로 강화


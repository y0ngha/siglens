# Fix Log

## [Issue #79 | fix/79/프롬프트-스키마-누락-필드-추가-에러-로깅-개선 | 2026-03-29]
- Violation: `!bars` 검증이 빈 배열 `[]`을 유효한 입력으로 통과시킴
- Rule: CONVENTIONS.md — 빈 bars 배열은 의미 있는 분석 결과를 기대할 수 없으므로, `!bars` 단독 검증으로는 caller에게 명확한 에러 응답을 줄 수 없음
- Context: `route.ts`의 입력 검증에서 `!bars`만으로는 빈 배열을 거르지 못하여, `bars.length === 0` 조건을 추가하여 빈 bars도 400 응답으로 처리

## [PR #82 | feat/81/gemini-ai-provider-지원-추가 | 2026-03-30]
- Violation: `process.env.AI_PROVIDER ?? DEFAULT_AI_PROVIDER`로 기본값을 먼저 할당한 뒤 `in` 연산자로 재검증하여 `undefined`인 경우를 올바르게 처리하지 못함
- Rule: CONVENTIONS.md Coding Paradigm — 중복 로직을 제거하고 단일 확인으로 단순화해야 함
- Context: `factory.ts`의 `createAIProvider`에서 `raw`에 기본값을 먼저 할당하면 `undefined` 케이스가 `in` 연산자 이전에 이미 처리되어 논리가 불명확해짐; `raw && raw in AI_PROVIDER_MAP` 패턴으로 단순화

## [Issue #84 | feat/84/AI-프롬프트-구체화-가격목표-핵심레벨-분석강화 | review fix | 2026-03-30]
- Violation: PoC div에 `col-span-2` 클래스가 적용되어 있으나 부모 컨테이너가 flex이므로 아무 효과가 없는 dead CSS
- Rule: CONVENTIONS.md — 불필요한 클래스는 제거해야 한다
- Context: `AnalysisPanel.tsx`의 PoC div 부모(line 496)는 `flex flex-col`이고 `grid grid-cols-2`(line 500)는 형제 div이므로 `col-span-2`가 적용될 그리드 컨텍스트가 없었음; `col-span-2`를 제거하여 해결

## [PR #97 | feat/87/인터랙티브-요소-커서-스타일-UX-개선 | 2026-03-31]
- Violation: `cursor-pointer`를 AnalysisPanel, TimeframeSelector, SymbolSearch 각 컴포넌트에 개별적으로 추가하여 중복 발생
- Rule: CONVENTIONS.md — 반복 패턴은 전역 스타일로 추출해야 한다; AHA 원칙 — 세 번 반복되면 추상화
- Context: 모든 `<button>` 요소에 동일하게 필요한 `cursor-pointer`를 `globals.css`의 `@layer base`에서 전역으로 선언하고, 각 컴포넌트의 className에서 `cursor-pointer` 및 `disabled:cursor-not-allowed`를 제거하여 중앙 관리

## [Issue #89 | feat/89/보조지표-show-hide-토글-UI | 2026-03-31]
- Violation: `IndicatorToolbarProps`에 `xyzVisible + onXYZToggle` 플랫 props 12개가 나열되어 새 지표 추가 시 props 2개씩 증가
- Rule: FF.md Coupling 4-A — 함께 변경되는 props는 묶어야 한다; 새 지표마다 interface와 호출 사이트 양쪽을 수정해야 하는 tight coupling
- Context: `bollingerVisible/onBollingerToggle` 등 4쌍을 `IndicatorToggleGroup { visible, onToggle }` 구조로 묶어 `bollinger`, `macd`, `rsi`, `dmi` 6개 props로 감소; `StockChart.tsx` 호출 사이트 동시 업데이트

## [PR #99 | feat/89/보조지표-show-hide-토글-UI | 2026-03-31]
- Violation: `IndicatorToolbar.tsx`에서 `getPeriodColor(period)` 반환값을 `style` prop으로 적용하는 코드에 허용 사유 주석이 없어 DESIGN.md 인라인 스타일 금지 규칙 위반 여부가 불명확했음
- Rule: DESIGN.md — 인라인 스타일은 금지; 단 런타임에 결정되는 동적 도메인 색상 상수(CHART_COLORS)는 Tailwind 임의값으로 표현 불가능하므로 예외 허용, 주석으로 명시 필요
- Context: `getPeriodColor`는 `CHART_COLORS` 기반 상수를 반환하는 런타임 동적 색상으로, Tailwind 임의값 문법으로 대체 불가능함을 주석으로 명시하여 의도를 문서화

## [Issue #91 | feat/91/candle-pattern-summary-ui | 2026-03-31]
- Violation: `skillsLoader.loadSkills().catch(() => [])` 패턴으로 skills 로딩 실패 시 에러를 로깅하지 않고 조용히 빈 배열로 fallback
- Rule: MISTAKES.md Domain Functions Rule 4 — `.catch(() => [])` hides the failure from the caller; at minimum `console.error` must be added inside the catch
- Context: `app/[symbol]/page.tsx`의 `Promise.all` 내 skills 로딩에서 에러 발생 시 caller가 degraded state 여부를 알 수 없었음; catch 블록에 `console.error('Skills load failed', error)` 추가

## [Issue #91 | feat/91/candle-pattern-summary-ui | 2026-03-31]
- Violation: `CandlePatternAccordionItem`에서 `CANDLE_PATTERN_LABELS as Record<string, string>` 타입 단언을 사용해 레이블 맵의 타입 안전성 우회
- Rule: CONVENTIONS.md — `as` type assertions are discouraged; use type guards or typed helpers instead
- Context: `AnalysisPanel.tsx`의 `patternLabel` 계산에서 `CandlePattern` 또는 `MultiCandlePattern` 중 어느 것인지 불명확한 `string` 패턴명을 처리하기 위해 `as` 단언을 사용함; `candle-labels.ts`에 `findCandlePatternLabel(patternName: string)` 헬퍼를 추가하여 `in` 연산자 기반 타입 가드로 안전하게 처리

## [PR #101 | feat/92/PatternResult-변환-및-patterns-prop-전달 | 2026-03-31]
- Violation: `enrichAnalysisWithConfidence`의 `patternSummaries.map` 콜백에서 `skillByName.get(p.skillName)`을 두 번 호출하여 동일 맵 조회가 중복됨
- Rule: FF.md Readability 1-A — 동일한 값을 두 번 계산하면 가독성과 효율성이 저하된다
- Context: `confidence.ts`의 `patternSummaries.map` 콜백에서 `const skill = skillByName.get(p.skillName)` 변수로 추출하여 한 번만 조회하도록 리팩토링

## [PR #101 | feat/92/PatternResult-변환-및-patterns-prop-전달 | 2026-03-31]
- Violation: `AnalyzingBanner`와 `ErrorBanner` 컴포넌트가 자신의 외부 여백(`mb-3`)을 직접 하드코딩
- Rule: MISTAKES.md Components Rule 11 — 컴포넌트는 자신의 외부 마진을 직접 선언해서는 안 됨; 외부 간격은 호출자가 관리해야 함
- Context: `ChartContent.tsx`에서 두 배너 컴포넌트의 `mb-3` 클래스를 제거하고, `AnalysisStatusBanner`에 `className` prop을 추가하여 호출자인 `ChartContent`가 `mb-3`을 직접 전달하도록 이동

## [PR #101 | feat/92/PatternResult-변환-및-patterns-prop-전달 | review fix 2 | 2026-03-31]
- Violation: `confidence.test.ts`에서 `TEST_MEDIUM_CONFIDENCE = 0.7` 상수를 로컬에서 재선언하여 사용함
- Rule: MISTAKES.md Tests Rule 10 — boundary test constants must be imported from the source module, not redeclared locally
- Context: `0.7`은 confidence 범위의 경계값으로 constants.ts에서 관리되어야 함; `MEDIUM_CONFIDENCE_WEIGHT = 0.7`을 constants.ts에 추가하고 테스트에서 import하도록 변경

## [PR #105 | refactor/104/AI-프롬프트-문자열-영어로-변환 | 2026-03-31]
- Violation: Using `getMultiCandlePatternLabel(multiPattern)` instead of the identifier `multiPattern` directly in English prompt string
- Rule: Prompt language consistency — all English prompt strings should use identifiers directly rather than calling a label function that may return different language labels
- Context: In `src/domain/analysis/prompt.ts` line 96, the multi-candle pattern was displayed using `getMultiCandlePatternLabel()` which is inconsistent with the all-English prompt approach; replaced with direct use of `multiPattern` identifier and removed the now-unused import

## [PR #105 | refactor/104/AI-프롬프트-문자열-영어로-변환 | 2026-03-31]
- Violation: Test file structure exceeded 3 levels (4 levels: describe('prompt') > describe('buildAnalysisPrompt') > describe(context) > it(behavior))
- Rule: MISTAKES.md Test Rule 9 — test file must use exactly 3 levels: describe(subject) > describe(context) > it(behavior)
- Context: In `src/__tests__/domain/analysis/prompt.test.ts`, the `describe('buildAnalysisPrompt')` wrapper was an unnecessary intermediate layer; removed it so all context describe blocks are directly under `describe('prompt')`

## [Issue #109 | feat/109/AI-분석-패널-너비-드래그-조절 | 2026-03-31]
- Violation: DOM event listeners (`mousemove`, `mouseup`) added directly inside a `useEffect` in `usePanelResize.ts` instead of being extracted to a custom hook
- Rule: MISTAKES.md Components Rule 13 — reusable DOM event listener patterns must be extracted to custom hooks (useOnClickOutside, useEscapeKey pattern)
- Context: The mousemove/mouseup drag tracking pattern in `usePanelResize` was extracted to a new `useDragListener` hook in `hooks/useDragListener.ts`, keeping the useEffect logic isolated and reusable

## [PR #112 | feat/109/AI-분석-패널-너비-드래그-조절 | 2026-03-31]
- Violation: `usePanelResize.ts`에서 `React.MouseEvent` 타입을 사용하면서 `React` import가 누락되어 TypeScript 컴파일 오류 발생
- Rule: TypeScript — 사용하는 모든 타입의 import가 명시되어야 한다
- Context: `import type React from 'react'`를 추가하고, `handleDragStart`가 `panelWidth` state에 의존하여 불필요하게 재생성되는 문제를 `panelWidthRef` + `useEffect` 패턴으로 해결하여 함수를 안정화

## [PR #112 | feat/109/AI-분석-패널-너비-드래그-조절 | 2026-03-31]
- Violation: `useDragListener.ts`에서 `onMouseMove`와 `onMouseUp` 외부 콜백 prop이 `useEffect` 의존성 배열에 포함되어 호출자가 `useCallback` 없이 인라인 함수를 전달할 경우 무한 루프 위험이 있었음
- Rule: MISTAKES.md Components Rule 8 — 외부 콜백 prop은 `useEffectEvent`로 래핑하여 의존성 배열에서 제외해야 한다
- Context: `useDragListener` 내부에서 두 콜백을 `useEffectEvent`로 감싸고 `useEffect` 의존성 배열에서 제거하여 호출자의 메모이제이션 여부와 무관하게 안전하게 동작하도록 수정

## [PR #112 | feat/109/AI-분석-패널-너비-드래그-조절 | review fix 3 | 2026-03-31]
- Violation: `ChartContent.tsx`의 드래그 핸들 `aria-valuemin={240}`, `aria-valuemax={640}`에 리터럴 값이 하드코딩되어 `usePanelResize.ts`의 `PANEL_MIN_WIDTH`, `PANEL_MAX_WIDTH`와 독립적으로 관리됨
- Rule: MISTAKES.md TypeScript Rule 6 — 하드코딩된 리터럴은 상수로 추출해야 함; FF.md Cohesion 3-B — 같은 값이 두 곳에 정의되면 한쪽만 변경될 위험이 있음
- Context: `PANEL_MIN_WIDTH`, `PANEL_MAX_WIDTH`를 `usePanelResize.ts`에서 `export`하고 `ChartContent.tsx`에서 import하여 참조하도록 수정

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

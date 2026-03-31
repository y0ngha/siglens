# Fix Log

## [Issue #79 | fix/79/프롬프트-스키마-누락-필드-추가-에러-로깅-개선 | 2026-03-29]
- Violation: `!bars` 검증이 빈 배열 `[]`을 유효한 입력으로 통과시킴
- Rule: CONVENTIONS.md — 빈 bars 배열은 의미 있는 분석 결과를 기대할 수 없으므로, `!bars` 단독 검증으로는 caller에게 명확한 에러 응답을 줄 수 없음
- Context: `route.ts`의 입력 검증에서 `!bars`만으로는 빈 배열을 거르지 못하여, `bars.length === 0` 조건을 추가하여 빈 bars도 400 응답으로 처리


## [Issue #79 | fix/79/프롬프트-스키마-누락-필드-추가-에러-로깅-개선 | review fix | 2026-03-29]
- Violation: `type이 pattern이 아닌 skill` 테스트에서 `makeSkill({ name: 'RSI 다이버전스' })`처럼 type 생략으로 `undefined !== 'pattern'`이라는 암묵적 사실에 의존함
- Rule: FF.md Readability 1-B — 구현 의도를 명확하게 표현해야 한다
- Context: `makeSkill`의 기본 `type` 값이 없으므로 생략 시 undefined가 되는데, 이 암묵적 동작에 의존하기보다 `type: undefined`를 명시하여 테스트 의도를 명확히 함

## [PR #82 | feat/81/gemini-ai-provider-지원-추가 | 2026-03-30]
- Violation: `process.env.AI_PROVIDER ?? DEFAULT_AI_PROVIDER`로 기본값을 먼저 할당한 뒤 `in` 연산자로 재검증하여 `undefined`인 경우를 올바르게 처리하지 못함
- Rule: CONVENTIONS.md Coding Paradigm — 중복 로직을 제거하고 단일 확인으로 단순화해야 함
- Context: `factory.ts`의 `createAIProvider`에서 `raw`에 기본값을 먼저 할당하면 `undefined` 케이스가 `in` 연산자 이전에 이미 처리되어 논리가 불명확해짐; `raw && raw in AI_PROVIDER_MAP` 패턴으로 단순화


## [PR #82 | feat/81/gemini-ai-provider-지원-추가 | 2026-03-30]
- Violation: `utils.test.ts`의 `stripMarkdownCodeBlock` 테스트가 코드 블록 앞/뒤에 일반 텍스트가 있는 경우를 커버하지 않음
- Rule: FF.md Cohesion 3-A — 함께 변경되는 코드는 같은 위치에 있어야 한다. 함수의 엣지 케이스 커버리지는 해당 함수가 위치한 파일의 테스트에 있어야 함
- Context: 코드 블록 앞/뒤 텍스트 처리는 `claude.test.ts`의 provider 레벨에서만 검증되고 있었으나, `stripMarkdownCodeBlock`이 `utils.ts`로 이동했으므로 해당 케이스를 `utils.test.ts`에 직접 추가




## [PR #90 | feat/83/skills-category-display-chart-overlay | 2026-03-30]
- Violation: `StockChart.tsx`의 `onPatternOverlayReady` prop 이름이 실제 동작(반복 호출)을 오해하게 만듦
- Rule: FF.md Predictability 2-C — 이름, 파라미터, 반환값만으로 동작을 예측할 수 있어야 함
- Context: prop이 초기화 완료 시 한 번만 호출되는 이벤트처럼 읽히나 실제로는 `visiblePatterns`나 `togglePattern` 변경 시마다 반복 호출됨. `onPatternOverlayChange`로 변경



## [PR #90 | feat/83/skills-category-display-chart-overlay | review fix 5 | 2026-03-30]
- Violation: `readFile`이 `Promise.all` 내부에서 rejection될 때 에러가 올바르게 전파되는지 검증하는 테스트 케이스 누락
- Rule: CONVENTIONS.md Test Rules — infrastructure/ 커버리지 목표 100%; readFile rejection 경로가 미검증 상태
- Context: `loader.ts`의 `loadSkills()`가 `Promise.all`을 사용하여 여러 파일을 병렬 로드하므로, readFile이 실패할 경우 Promise.all 전체가 reject되어야 함. `readFile 에러` describe 블록과 `readFile이 실패하면 에러를 전파한다` it 케이스를 추가하여 EACCES 에러 전파를 검증


## [Issue #84 | feat/84/AI-프롬프트-구체화-가격목표-핵심레벨-분석강화 | review fix | 2026-03-30]
- Violation: PoC div에 `col-span-2` 클래스가 적용되어 있으나 부모 컨테이너가 flex이므로 아무 효과가 없는 dead CSS
- Rule: CONVENTIONS.md — 불필요한 클래스는 제거해야 한다
- Context: `AnalysisPanel.tsx`의 PoC div 부모(line 496)는 `flex flex-col`이고 `grid grid-cols-2`(line 500)는 형제 div이므로 `col-span-2`가 적용될 그리드 컨텍스트가 없었음; `col-span-2`를 제거하여 해결

## [Issue #84 | feat/84/AI-프롬프트-구체화-가격목표-핵심레벨-분석강화 | review fix 2 | 2026-03-30]
- Violation: `SIGLENS_API.md`의 `AnalysisResponse` 인터페이스 정의에 `patternSummaries`와 `skillResults` 필드가 누락되어 `domain/types.ts`와 불일치
- Rule: CONVENTIONS.md — 문서는 실제 구현과 일치해야 한다
- Context: `domain/types.ts`의 `AnalysisResponse`에는 `patternSummaries: PatternSummary[]`, `skillResults: SkillResult[]`가 정의되어 있으나 SIGLENS_API.md에는 없었음; `PatternSummary`, `SkillResult` 인터페이스 정의와 함께 두 필드를 추가하고 JSON 예시에도 빈 배열로 반영


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

## [PR #99 | feat/89/보조지표-show-hide-토글-UI | 2026-03-31]
- Violation: `IndicatorToolbar.tsx`에서 `handleClickOutside`를 `useCallback`으로 래핑하여 `useOnClickOutside`에 전달함
- Rule: FF.md Readability 1-B — 불필요한 추상화 레이어는 노이즈를 추가하고 의도를 모호하게 만든다
- Context: `useOnClickOutside`가 내부적으로 `useEffectEvent`를 통해 핸들러 참조 안정성을 보장하므로, 콜 사이트에서 `useCallback`을 감쌀 이유가 없음; `useCallback` 제거 후 인라인 콜백으로 단순화

## [Issue #91 | feat/91/candle-pattern-summary-ui | 2026-03-31]
- Violation: `skillsLoader.loadSkills().catch(() => [])` 패턴으로 skills 로딩 실패 시 에러를 로깅하지 않고 조용히 빈 배열로 fallback
- Rule: MISTAKES.md Domain Functions Rule 4 — `.catch(() => [])` hides the failure from the caller; at minimum `console.error` must be added inside the catch
- Context: `app/[symbol]/page.tsx`의 `Promise.all` 내 skills 로딩에서 에러 발생 시 caller가 degraded state 여부를 알 수 없었음; catch 블록에 `console.error('Skills load failed', error)` 추가

## [Issue #91 | feat/91/candle-pattern-summary-ui | 2026-03-31]
- Violation: `CandlePatternAccordionItem`에서 `CANDLE_PATTERN_LABELS as Record<string, string>` 타입 단언을 사용해 레이블 맵의 타입 안전성 우회
- Rule: CONVENTIONS.md — `as` type assertions are discouraged; use type guards or typed helpers instead
- Context: `AnalysisPanel.tsx`의 `patternLabel` 계산에서 `CandlePattern` 또는 `MultiCandlePattern` 중 어느 것인지 불명확한 `string` 패턴명을 처리하기 위해 `as` 단언을 사용함; `candle-labels.ts`에 `findCandlePatternLabel(patternName: string)` 헬퍼를 추가하여 `in` 연산자 기반 타입 가드로 안전하게 처리

## [PR #100 | feat/91/candle-pattern-summary-ui | 2026-03-31]
- Violation: `findCandlePatternLabel`에서 `in` 연산자로 패턴명 존재 여부를 확인하여 프로토타입 체인(`toString` 등)에 있는 속성에 대해 `true`를 반환할 수 있는 위험이 있었음
- Rule: FF.md Predictability 2-C — 외부 입력값(AI 응답)에 기반한 객체 조회는 프로토타입 오염에 안전한 방식을 사용해야 함
- Context: `candle-labels.ts`의 `findCandlePatternLabel`에서 `in` 연산자 대신 직접 인덱스 접근 `(obj as Record<string, string>)[key]`를 사용하는 방식으로 변경하여 프로토타입 체인 조회 위험 제거

## [PR #100 | feat/91/candle-pattern-summary-ui | review fix 2 | 2026-03-31]
- Violation: `findCandlePatternLabel`에서 `||` 연산자를 사용하여 레이블 fallback을 처리함으로써 빈 문자열도 falsy로 처리되어 의도가 불명확했음
- Rule: FF.md Predictability 2-C — 코드의 동작 의도가 구현에서 명확히 드러나야 한다
- Context: `candle-labels.ts`의 `findCandlePatternLabel`에서 객체 인덱스 접근 결과가 `undefined`일 때만 fallback하는 의도를 표현하기 위해 `||`를 `??`(nullish coalescing)으로 교체

## [PR #101 | feat/92/PatternResult-변환-및-patterns-prop-전달 | 2026-03-31]
- Violation: PR 설명에 명시된 `filterPatterns` 함수(confidenceWeight 0.5 이상 필터링)가 실제 코드에 구현되지 않음
- Rule: CONVENTIONS.md — 구현 설명과 실제 코드 사이에 불일치가 있어서는 안 된다
- Context: `confidence.ts`에 `filterPatterns(patterns: PatternResult[]): PatternResult[]` 함수를 추가하고, `MIN_CONFIDENCE_WEIGHT` 상수로 필터링 기준을 표현; 대응 테스트 케이스 3개 추가

## [PR #101 | feat/92/PatternResult-변환-및-patterns-prop-전달 | 2026-03-31]
- Violation: `enrichAnalysisWithConfidence`의 `patternSummaries.map` 콜백에서 `skillByName.get(p.skillName)`을 두 번 호출하여 동일 맵 조회가 중복됨
- Rule: FF.md Readability 1-A — 동일한 값을 두 번 계산하면 가독성과 효율성이 저하된다
- Context: `confidence.ts`의 `patternSummaries.map` 콜백에서 `const skill = skillByName.get(p.skillName)` 변수로 추출하여 한 번만 조회하도록 리팩토링

## [PR #101 | feat/92/PatternResult-변환-및-patterns-prop-전달 | 2026-03-31]
- Violation: `AnalyzingBanner`와 `ErrorBanner` 컴포넌트가 자신의 외부 여백(`mb-3`)을 직접 하드코딩
- Rule: MISTAKES.md Components Rule 11 — 컴포넌트는 자신의 외부 마진을 직접 선언해서는 안 됨; 외부 간격은 호출자가 관리해야 함
- Context: `ChartContent.tsx`에서 두 배너 컴포넌트의 `mb-3` 클래스를 제거하고, `AnalysisStatusBanner`의 반환부에서 래퍼 `div.mb-3`으로 간격을 관리하도록 이동


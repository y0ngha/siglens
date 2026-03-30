# Fix Log

## [PR #99 | feat/89/보조지표-show-hide-토글-UI | 2026-03-31]
- Violation: `DropdownIndicatorConfig.type` field inlined a 2-member union literal `'ma' | 'ema'` directly in the interface
- Rule: MISTAKES.md TypeScript Rule 5 — union literals with 2+ members must not be inlined in interface fields; extract to a named type alias
- Context: Both `DropdownType` and `DropdownIndicatorConfig.type` used `'ma' | 'ema'` inline; extracted to `type IndicatorType = 'ma' | 'ema'` and updated both usages

## [PR #99 | feat/89/보조지표-show-hide-토글-UI | 2026-03-31]
- Violation: `commonHookParams` 변수에 객체 타입이 함수 바디 내에 인라인으로 선언됨
- Rule: MISTAKES.md TypeScript Rule 4 — 함수 내부에 타입 선언 금지; 파일 상단 named interface로 추출
- Context: `StockChart` 컴포넌트 내부에서 `commonHookParams: { chartRef: ...; bars: ...; indicators: ...; lineWidth: ... }`와 같이 객체 리터럴 타입을 인라인으로 작성하고 있었으며, `interface CommonHookParams`로 파일 상단에 추출하여 해결

## [PR #95 | feat/85/신뢰도-배지-및-한국어-패턴명 | 2026-03-30]
- Violation: `enrichAnalysisWithConfidence`가 `prompt.ts`에 동거하여 단일 책임 원칙 위반
- Rule: FF.md Coupling 4-A (독립적으로 변경될 수 있는 두 함수는 분리)
- Context: AI 프롬프트 생성(`buildAnalysisPrompt`)과 신뢰도 데이터 주입(`enrichAnalysisWithConfidence`)은 독립적으로 변경되는 관심사이므로, `domain/analysis/confidence.ts`로 분리하여 해결


## [PR #78 | feat/74/AnalysisPanel-개선-아코디언-토글 | 2026-03-29]
- Violation: `DETECTED_BADGE_CONFIG`의 `Record` 키 타입에 인라인 유니온 리터럴 `'detected' | 'undetected'`(2개 멤버)가 직접 작성됨
- Rule: MISTAKES.md TypeScript Rule 5 — 2개 이상의 유니온 리터럴은 인라인으로 작성하지 않고 별도 type alias로 추출한다
- Context: `DETECTED_BADGE_CONFIG`의 Record 키 타입에 인라인으로 유니온을 선언하고 있었으며, `type DetectionStatus = 'detected' | 'undetected'`로 추출하여 규칙을 준수

## [Issue #79 | fix/79/프롬프트-스키마-누락-필드-추가-에러-로깅-개선 | 2026-03-29]
- Violation: `skillsLoader.loadSkills()` 실패 시 에러 로깅 없이 빈 배열로 fallback 처리됨
- Rule: CONVENTIONS.md — 에러 로깅 개선이 브랜치 목적임에도 skills 로딩 실패는 조용히 무시되어 디버깅 시 원인 추적이 어려움
- Context: `route.ts`의 `.catch(() => [])` 핸들러가 AI 분석 실패와 달리 `console.error` 없이 처리되고 있었으며, `.catch((error: unknown) => { console.error(...); return []; })`로 수정하여 skills 로딩 실패도 로그가 남도록 통일

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
- Violation: `StockChart.tsx`에서 6개의 인디케이터 훅에 동일한 파라미터 객체(`chartRef, bars, indicators, lineWidth`)가 반복 전달됨
- Rule: FF.md Readability 1-A — 동일한 값을 반복 작성하지 않고 공통 상수로 추출; AHA 원칙
- Context: `commonHookParams` 객체를 `LineWidth` 타입을 명시하여 선언하고 6개 훅(`useMAOverlay`, `useEMAOverlay`, `useBollingerOverlay`, `useMACDChart`, `useRSIChart`, `useDMIChart`) 호출에서 spread 대신 직접 전달


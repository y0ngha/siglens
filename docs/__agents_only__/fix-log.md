# Fix Log

## [Issue #74 | feat/74/AnalysisPanel-개선-아코디언-토글 | 2026-03-29]
- Violation: `beforeEach`가 `describe` 블록 바깥 최상위 레벨에 위치하여 테스트 구조 규칙 위반
- Rule: CONVENTIONS.md — Test Rules: 모든 setup 코드는 해당 describe 블록 내부에 위치해야 일관성 유지
- Context: `analysisApi.test.ts`의 `mockFetch.mockReset()` beforeEach가 최상위에 있었으며, 가장 가까운 `describe('postAnalyze 함수는')` 블록 내부로 이동하여 해결

## [PR #78 | feat/74/AnalysisPanel-개선-아코디언-토글 | 2026-03-29]
- Violation: `PatternAccordionItem` 트리거(`role="button"`)와 `SkillAccordionItem` 버튼에 `aria-expanded` 속성 누락
- Rule: ARIA 명세 — 아코디언 트리거는 `aria-expanded` 속성으로 패널의 열림/닫힘 상태를 스크린 리더에 노출해야 함
- Context: `PatternAccordionItem`의 `div[role="button"]`과 `SkillAccordionItem`의 `<button>` 모두 `isOpen` 상태를 갖고 있으나 `aria-expanded` 속성이 없어 접근성 미충족

## [PR #78 | feat/74/AnalysisPanel-개선-아코디언-토글 | 2026-03-29]
- Violation: `PatternAccordionItem`과 `SkillAccordionItem`에서 `isOpen && (...)` 패턴으로 조건부 렌더링을 구현함
- Rule: CONVENTIONS.md / vercel-react-best-practices `rendering-conditional-render` — `&&`보다 삼항 연산자(`condition ? <A /> : null`)를 사용하는 것이 권장됨
- Context: 두 아코디언 컴포넌트의 콘텐츠 패널이 모두 `isOpen && (<div>...)` 패턴을 사용하고 있었으며, `isOpen ? (<div>...) : null`로 수정하여 규칙을 준수

## [PR #78 | feat/74/AnalysisPanel-개선-아코디언-토글 | 2026-03-29]
- Violation: `pattern.detected`에 따라 '감지됨'/'미감지' 텍스트를 if/else 분기(`? ... : ...`)로 렌더링하여 동시에 실행되지 않는 상태가 한 컴포넌트 안에 혼재함
- Rule: FF.md 1-A — 동시에 실행되지 않는 상태는 분리하거나 객체 맵으로 선언적으로 표현하는 것이 가독성을 높임
- Context: `PatternAccordionItem` 내부에서 `pattern.detected`에 따라 다른 className과 label을 렌더링하는 로직을 `DETECTED_BADGE_CONFIG` 객체 맵과 `DetectedBadge` 컴포넌트로 분리하여 선언적으로 표현

## [PR #78 | feat/74/AnalysisPanel-개선-아코디언-토글 | 2026-03-29]
- Violation: `EyeIcon` 컴포넌트에서 `if (isVisible)` 조기 반환 패턴(명령형)을 사용하여 컴포넌트 선언적 스타일 규칙 위반
- Rule: CONVENTIONS.md — Declarative required for components: 컴포넌트는 선언적 스타일을 필수로 사용해야 함
- Context: `EyeIcon`이 `isVisible` 값에 따라 if/return 분기로 두 개의 SVG 중 하나를 반환하고 있었으며, 삼항 연산자(`isVisible ? <svg>...</svg> : <svg>...</svg>`)로 변경하여 선언적 스타일을 준수

## [PR #78 | feat/74/AnalysisPanel-개선-아코디언-토글 | 2026-03-29]
- Violation: `DETECTED_BADGE_CONFIG`의 `Record` 키 타입에 인라인 유니온 리터럴 `'detected' | 'undetected'`(2개 멤버)가 직접 작성됨
- Rule: MISTAKES.md TypeScript Rule 5 — 2개 이상의 유니온 리터럴은 인라인으로 작성하지 않고 별도 type alias로 추출한다
- Context: `DETECTED_BADGE_CONFIG`의 Record 키 타입에 인라인으로 유니온을 선언하고 있었으며, `type DetectionStatus = 'detected' | 'undetected'`로 추출하여 규칙을 준수

## [PR #78 | feat/74/AnalysisPanel-개선-아코디언-토글 | 2026-03-29]
- Violation: `DetectedBadge` 컴포넌트가 자신의 외부 마진 `mb-2`를 내부 wrapper에 하드코딩하여 재사용 시 레이아웃 조정 불가
- Rule: DESIGN.md / Component 설계 원칙 — 컴포넌트는 자신의 외부 여백(margin)을 직접 관리하지 않아야 하며, 호출 측에서 레이아웃을 제어해야 한다
- Context: `DetectedBadge` 내부 `div`에 `mb-2`가 있어 컴포넌트가 배치되는 컨텍스트에 관계없이 항상 하단 마진이 적용됨; `mb-2`를 제거하고 호출 측인 `PatternAccordionItem`의 wrapper `div`로 이동하여 해결

## [Issue #79 | fix/79/프롬프트-스키마-누락-필드-추가-에러-로깅-개선 | 2026-03-29]
- Violation: `skillsLoader.loadSkills()` 실패 시 에러 로깅 없이 빈 배열로 fallback 처리됨
- Rule: CONVENTIONS.md — 에러 로깅 개선이 브랜치 목적임에도 skills 로딩 실패는 조용히 무시되어 디버깅 시 원인 추적이 어려움
- Context: `route.ts`의 `.catch(() => [])` 핸들러가 AI 분석 실패와 달리 `console.error` 없이 처리되고 있었으며, `.catch((error: unknown) => { console.error(...); return []; })`로 수정하여 skills 로딩 실패도 로그가 남도록 통일

## [Issue #79 | fix/79/프롬프트-스키마-누락-필드-추가-에러-로깅-개선 | 2026-03-29]
- Violation: `!bars` 검증이 빈 배열 `[]`을 유효한 입력으로 통과시킴
- Rule: CONVENTIONS.md — 빈 bars 배열은 의미 있는 분석 결과를 기대할 수 없으므로, `!bars` 단독 검증으로는 caller에게 명확한 에러 응답을 줄 수 없음
- Context: `route.ts`의 입력 검증에서 `!bars`만으로는 빈 배열을 거르지 못하여, `bars.length === 0` 조건을 추가하여 빈 bars도 400 응답으로 처리

## [Issue #79 | fix/79/프롬프트-스키마-누락-필드-추가-에러-로깅-개선 | review fix | 2026-03-29]
- Violation: skills 로딩 실패 시 빈 배열로 fallback되었으나 응답 JSON에 그 사실이 반영되지 않아 호출 측에서 degraded 상태를 알 수 없음
- Rule: FF.md Predictability 2-C — 숨겨진 로직을 명시적으로 드러내야 한다
- Context: `route.ts`에서 skills 로딩이 실패해도 클라이언트에 반환되는 분석 결과에 표시가 없었음; `AnalysisResponse`에 optional `skillsDegraded` 필드를 추가하고 route.ts에서 `skillsDegraded: true`를 포함해 반환하도록 수정

## [Issue #79 | fix/79/프롬프트-스키마-누락-필드-추가-에러-로깅-개선 | review fix | 2026-03-29]
- Violation: `type이 pattern이 아닌 skill` 테스트에서 `makeSkill({ name: 'RSI 다이버전스' })`처럼 type 생략으로 `undefined !== 'pattern'`이라는 암묵적 사실에 의존함
- Rule: FF.md Readability 1-B — 구현 의도를 명확하게 표현해야 한다
- Context: `makeSkill`의 기본 `type` 값이 없으므로 생략 시 undefined가 되는데, 이 암묵적 동작에 의존하기보다 `type: undefined`를 명시하여 테스트 의도를 명확히 함

## [Issue #79 | fix/79/프롬프트-스키마-누락-필드-추가-에러-로깅-개선 | review fix 2 | 2026-03-29]
- Violation: `let skillsDegraded = false`로 선언 후 `.catch()` 내부에서 `skillsDegraded = true`로 재할당하는 패턴 사용
- Rule: MISTAKES.md Coding Paradigm Rule 3 — let reassignment → Use const + new variable
- Context: `route.ts`의 skills 로딩 로직에서 `let` 재할당 패턴이 사용되었으며, `.then(loadedSkills => ({ skills: loadedSkills, skillsDegraded: false })).catch(...)` 패턴으로 변경하여 `const` 구조 분해로 두 값을 동시에 획득하도록 수정


## [Issue #81 | feat/81/gemini-ai-provider-지원-추가 | 2026-03-30]
- Violation: `MARKDOWN_CODE_BLOCK_PATTERN`과 `stripMarkdownCodeBlock`이 `claude.ts`와 `gemini.ts`에 동일하게 중복 정의됨
- Rule: MISTAKES.md Coding Paradigm #8 — 같은 알고리즘을 재구현하지 말 것. 새 함수를 작성하기 전에 기존 헬퍼를 확인할 것.
- Context: 두 AI provider 파일에 동일한 정규식 패턴과 헬퍼 함수가 각각 선언되어 있었으며, `src/infrastructure/ai/utils.ts`로 추출하고 양쪽에서 임포트하도록 수정

## [Issue #81 | feat/81/gemini-ai-provider-지원-추가 | review fix | 2026-03-30]
- Violation: `gemini.ts`의 상수명 `GEMINI_SYSTEM_INSTRUCTION`이 `claude.ts`의 `CLAUDE_SYSTEM_PROMPT`와 다른 어휘를 사용함
- Rule: FF.md Predictability 2-A — 같은 역할을 하는 상수는 같은 네이밍 컨벤션을 따라야 한다
- Context: 두 provider 모두 AI에 전달하는 시스템 지시문 상수를 가지고 있으나 `INSTRUCTION` vs `PROMPT`로 다르게 명명되어 있었으며, `GEMINI_SYSTEM_PROMPT`로 통일하여 독자가 두 파일을 비교할 때 정신적 매핑이 필요 없도록 수정

## [Issue #81 | feat/81/gemini-ai-provider-지원-추가 | review fix 2 | 2026-03-30]
- Violation: `GEMINI_SYSTEM_PROMPT`와 `CLAUDE_SYSTEM_PROMPT`가 동일한 문자열 값을 각 파일에 별도로 선언함
- Rule: FF.md Cohesion 3-B — 동일한 값이 두 파일에 분산되면 한쪽만 수정될 위험이 있음; 단일 지점에서 관리해야 함
- Context: `claude.ts`와 `gemini.ts` 각각에 동일한 system prompt 상수가 중복 선언되어 있었으며, `utils.ts`에 `AI_SYSTEM_PROMPT` 공통 상수를 추출하고 두 파일에서 import하도록 수정

## [PR #82 | feat/81/gemini-ai-provider-지원-추가 | 2026-03-30]
- Violation: `process.env.AI_PROVIDER ?? DEFAULT_AI_PROVIDER`로 기본값을 먼저 할당한 뒤 `in` 연산자로 재검증하여 `undefined`인 경우를 올바르게 처리하지 못함
- Rule: CONVENTIONS.md Coding Paradigm — 중복 로직을 제거하고 단일 확인으로 단순화해야 함
- Context: `factory.ts`의 `createAIProvider`에서 `raw`에 기본값을 먼저 할당하면 `undefined` 케이스가 `in` 연산자 이전에 이미 처리되어 논리가 불명확해짐; `raw && raw in AI_PROVIDER_MAP` 패턴으로 단순화

## [PR #82 | feat/81/gemini-ai-provider-지원-추가 | 2026-03-30]
- Violation: `gemini.ts`의 JSON 파싱 실패 `catch` 블록에서 원본 에러를 무시하고 새 에러만 throw함
- Rule: FF.md Predictability 2-C — 숨겨진 정보(원본 에러)를 명시적으로 드러내야 디버깅이 가능함
- Context: `catch {}` 블록에서 에러 인자를 받지 않고 새 Error만 throw하여 원본 파싱 에러와 실패한 raw text가 손실됨; `cause: error` 옵션과 `console.error`로 원본 에러 및 텍스트를 포함하도록 수정


## [PR #82 | feat/81/gemini-ai-provider-지원-추가 | 2026-03-30]
- Violation: `factory.test.ts`의 `beforeEach`에서 `jest.resetModules()`를 호출하지만, 모든 import가 모듈 로드 시점에 이미 바인딩되어 있어 reset이 실제로 아무 효과도 없음
- Rule: FF.md Readability — 오해를 유발하는 코드는 가독성을 떨어뜨림; 미래 독자가 모듈 캐시가 격리된다고 잘못 이해할 수 있음
- Context: `factory.test.ts`는 `process.env`를 호출 시점에 읽는 factory 함수를 테스트하므로 모듈 캐시 격리가 불필요하며, 의미 없는 `jest.resetModules()` 호출을 제거하여 혼란 방지

## [PR #82 | feat/81/gemini-ai-provider-지원-추가 | 2026-03-30]
- Violation: `utils.test.ts`의 `stripMarkdownCodeBlock` 테스트가 코드 블록 앞/뒤에 일반 텍스트가 있는 경우를 커버하지 않음
- Rule: FF.md Cohesion 3-A — 함께 변경되는 코드는 같은 위치에 있어야 한다. 함수의 엣지 케이스 커버리지는 해당 함수가 위치한 파일의 테스트에 있어야 함
- Context: 코드 블록 앞/뒤 텍스트 처리는 `claude.test.ts`의 provider 레벨에서만 검증되고 있었으나, `stripMarkdownCodeBlock`이 `utils.ts`로 이동했으므로 해당 케이스를 `utils.test.ts`에 직접 추가

## [PR #82 | feat/81/gemini-ai-provider-지원-추가 | 2026-03-30]
- Violation: `describe('생성자를 호출하면')` 중간 계층이 추가되어 테스트 구조가 4단계(describe → describe → describe → it)가 됨
- Rule: MISTAKES.md Tests Rule 6 — `describe(subject) → describe(context) → it(behavior)` 3단계 구조가 필수이며, 4단계 중첩은 규칙 위반
- Context: `gemini.test.ts`의 `GEMINI_API_KEY가 설정되지 않은 경우` describe 블록 안에 불필요한 `생성자를 호출하면` describe 계층이 있었음; `describe('생성자를 호출하면')` 계층을 제거하고 해당 내용을 `it('생성자를 호출하면 에러를 던진다')` 설명에 통합하여 3단계로 통일

## [Issue #83 | feat/83/skills-category-display-chart-overlay | 2026-03-30]
- Violation: `toSkill` 함수에서 `Skill.pattern?` 필드를 파싱하지 않아 domain interface와 infrastructure 파서 간 불일치 발생
- Rule: MISTAKES.md TypeScript #11 — domain 인터페이스에 필드가 존재하면 infrastructure 파서에서 반드시 해당 필드를 파싱해야 한다
- Context: `loader.ts`의 `toSkill`에 `pattern` 파싱 라인이 누락되어 있었으며, `data.pattern != null ? String(data.pattern) : undefined`를 추가하여 skills MD의 `pattern` frontmatter 필드를 올바르게 파싱하도록 수정

## [Issue #83 | feat/83/skills-category-display-chart-overlay | 2026-03-30]
- Violation: `Skill.pattern` 필드가 domain 타입에 있지만 loader 테스트에서 해당 필드를 전혀 검증하지 않음
- Rule: MISTAKES.md Tests #3 — 타입/인터페이스에 새 필드가 추가될 때 반드시 해당 필드의 존재 여부 또는 값을 검증하는 it() 케이스가 있어야 한다
- Context: `loader.test.ts`에 `SKILL_WITH_PATTERN_MD` 픽스처와 `pattern 파싱` describe 블록을 추가하여 `pattern: 'head_and_shoulders'` 파싱과 pattern 미존재 시 undefined 반환을 검증

## [Issue #83 | feat/83/skills-category-display-chart-overlay | review fix | 2026-03-30]
- Violation: `usePatternOverlay`의 초기 `visiblePatterns`가 빈 Set으로 설정되어 detected 패턴이 기본적으로 차트에 표시되지 않음; `StockChart`에서 반환값(`visiblePatterns`, `togglePattern`)을 무시하여 toggle 기능이 외부에 노출되지 않음
- Rule: FF.md Predictability 2-C — 숨겨진 상태(초기 empty Set으로 인한 영구 비표시)를 명시적으로 드러내야 한다; CONVENTIONS.md Custom Hook Rules — 훅의 반환값은 사용되어야 한다
- Context: `usePatternOverlay`가 `useState(new Set())`으로 초기화되어 있어 detected 패턴들이 기본 표시되지 않았음; lazy initializer로 `new Set(patterns.filter(p => p.detected).map(p => p.patternName))`를 사용하고, `StockChart`에 `onPatternOverlayReady` prop을 추가하여 `visiblePatterns`와 `togglePattern`을 상위로 전달 가능하게 수정

## [Issue #83 | feat/83/skills-category-display-chart-overlay | review fix | 2026-03-30]
- Violation: 첫 번째 정상 케이스 `toEqual`에서 `category`, `pattern`, `display` 필드가 `undefined`임을 명시적으로 검증하지 않음
- Rule: MISTAKES.md Tests Rule 3 — 타입에 존재하는 필드는 검증 케이스를 가져야 한다
- Context: `VALID_SKILL_MD` 픽스처에는 `category`, `pattern`, `display` 필드가 없으므로 `toSkill`이 이들을 `undefined`로 반환해야 하며, `toEqual` 기대값에 `category: undefined, pattern: undefined, display: undefined`를 명시적으로 추가하여 향후 `toSkill` 변경 시 회귀를 탐지할 수 있도록 수정

## [PR #76 | fix/72/타임프레임-변경-시-AI-분석-자동-업데이트 | 2026-03-29]
- Violation: `useRef(timeframeChangeCount)`로 초기화하여 Suspense remount 시 ref가 현재 count 값으로 초기화되어 타임프레임 변경 분석이 실행되지 않는 버그
- Rule: MISTAKES.md — Components: Managing timeframe as URL query parameter / useEffect Side Effect Isolation (올바른 초기값으로 ref를 초기화해야 함)
- Context: `useBars`가 `useSuspenseQuery`를 사용하기 때문에 캐시 miss 시 ChartContent가 remount되는데, 이때 `useRef(timeframeChangeCount)`로 초기화하면 ref.current가 현재 count 값과 동일해져서 useEffect에서 조기 반환이 발생하여 분석이 실행되지 않음. `useRef(0)`으로 초기화해야 remount 시에도 올바르게 동작함.

## [PR #90 | feat/83/skills-category-display-chart-overlay | 2026-03-30]
- Violation: `useState` lazy initializer로 `patterns` prop으로부터 초기 `visiblePatterns`를 계산하여 이후 prop 변경 시 동기화되지 않는 버그
- Rule: MISTAKES.md Components Rule 6 — stale closure state 사용 금지; `useState` initializer는 초기 렌더링에만 실행되므로 이후 prop 변경이 반영되지 않음
- Context: `usePatternOverlay`에서 `patterns`가 비동기로 로드되는 경우 lazy initializer가 빈 배열로 실행되어 패턴이 차트에 표시되지 않는 버그 발생. `useReducer`와 `dispatch({ type: 'reset' })`으로 prop 변경 시 동기화

## [PR #90 | feat/83/skills-category-display-chart-overlay | 2026-03-30]
- Violation: `useEffect` 두 곳에서 `patterns.filter(p => p.detected && p.renderConfig)` 중복 계산
- Rule: FF.md Cohesion 3-B — 같은 값이 여러 곳에 흩어지면 변경 시 누락 위험; `useMemo`로 단일 출처(single source of truth) 유지
- Context: `usePatternOverlay`의 시리즈 lifecycle 관리 effect와 데이터 동기화 effect 양쪽에서 동일한 필터링이 반복됨. `detectedPatterns` useMemo로 추출하여 두 effect에서 공유

## [PR #90 | feat/83/skills-category-display-chart-overlay | 2026-03-30]
- Violation: `loader.ts` `parseYamlBlock`에서 `let i = 0; while (i < lines.length)` + `i++` 패턴 사용
- Rule: MISTAKES.md Coding Paradigm Rule 1, 3 — 데이터 변환에 for/while 금지; let 재할당 금지
- Context: YAML 중첩 블록 파싱 함수에서 명령형 루프와 let 재할당으로 구현됨. `reduce` 기반 선언적 구현으로 교체하고 라인 분류 로직을 `classifyLine` 순수 함수로 추출

## [PR #90 | feat/83/skills-category-display-chart-overlay | 2026-03-30]
- Violation: `StockChart.tsx`의 `onPatternOverlayReady` prop 이름이 실제 동작(반복 호출)을 오해하게 만듦
- Rule: FF.md Predictability 2-C — 이름, 파라미터, 반환값만으로 동작을 예측할 수 있어야 함
- Context: prop이 초기화 완료 시 한 번만 호출되는 이벤트처럼 읽히나 실제로는 `visiblePatterns`나 `togglePattern` 변경 시마다 반복 호출됨. `onPatternOverlayChange`로 변경

## [PR #90 | feat/83/skills-category-display-chart-overlay | review fix 2 | 2026-03-30]
- Violation: `StockChart.tsx`의 `useEffect`에서 `onPatternOverlayChange` 콜백 prop이 dependency 배열에 포함되어, 호출자가 인라인 함수로 전달하면 매 렌더마다 effect가 재실행되는 무한 루프 위험
- Rule: MISTAKES.md Components Rule — 외부 콜백 prop은 useEffectEvent로 래핑하여 dependency에서 제외해야 한다; FF.md Predictability 2-C(hidden behavior) 위반
- Context: `onPatternOverlayChange`를 `useEffectEvent`로 래핑하여 `notifyPatternOverlayChange`로 만들고, `useEffect`의 dependency 배열에서 해당 prop을 제거하여 안정적인 effect 실행을 보장


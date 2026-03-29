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

## [Issue #79 | fix/79/프롬프트-스키마-누락-필드-추가-에러-로깅-개선 | review fix 3 | 2026-03-29]
- Violation: `AnalyzeRequest` 인터페이스가 `domain/types.ts`의 `AnalyzeVariables`와 동일한 구조를 `app/api/analyze/route.ts`에서 중복 정의하고 있었음
- Rule: FF.md Cohesion 3-A — 함께 변경되어야 하는 코드는 함께 위치해야 한다. `AnalyzeVariables`에 필드가 추가/변경될 때 `AnalyzeRequest`도 동기화되어야 하는 암묵적 결합이 발생함
- Context: `app` 레이어는 `domain` 타입 import가 허용되므로, `AnalyzeRequest`를 제거하고 `AnalyzeVariables`를 직접 재사용하도록 수정하여 암묵적 결합을 제거

## [PR #76 | fix/72/타임프레임-변경-시-AI-분석-자동-업데이트 | 2026-03-29]
- Violation: `useRef(timeframeChangeCount)`로 초기화하여 Suspense remount 시 ref가 현재 count 값으로 초기화되어 타임프레임 변경 분석이 실행되지 않는 버그
- Rule: MISTAKES.md — Components: Managing timeframe as URL query parameter / useEffect Side Effect Isolation (올바른 초기값으로 ref를 초기화해야 함)
- Context: `useBars`가 `useSuspenseQuery`를 사용하기 때문에 캐시 miss 시 ChartContent가 remount되는데, 이때 `useRef(timeframeChangeCount)`로 초기화하면 ref.current가 현재 count 값과 동일해져서 useEffect에서 조기 반환이 발생하여 분석이 실행되지 않음. `useRef(0)`으로 초기화해야 remount 시에도 올바르게 동작함.

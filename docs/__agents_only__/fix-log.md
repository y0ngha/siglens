# Fix Log

## [Issue #74 | feat/74/AnalysisPanel-개선-아코디언-토글 | 2026-03-29]
- Violation: `PatternAccordionItem`에서 `<button>` 안에 `<button>`을 중첩하여 HTML 명세 위반 및 접근성 문제 발생
- Rule: HTML 명세 — interactive content는 `<button>` 내부에 위치 불가; 브라우저가 DOM을 자동 수정하면서 예상치 못한 이벤트 동작 유발
- Context: 아코디언 헤더(handleToggleOpen)가 `<button>`이고 그 내부에 눈 아이콘 토글(handleToggleVisibility)도 `<button>`으로 구현되어 중첩 발생; 외부 버튼을 `<div role="button" tabIndex={0}>`으로 변경하여 해결

## [Issue #74 | feat/74/AnalysisPanel-개선-아코디언-토글 | 2026-03-29]
- Violation: `beforeEach`가 `describe` 블록 바깥 최상위 레벨에 위치하여 테스트 구조 규칙 위반
- Rule: CONVENTIONS.md — Test Rules: 모든 setup 코드는 해당 describe 블록 내부에 위치해야 일관성 유지
- Context: `analysisApi.test.ts`의 `mockFetch.mockReset()` beforeEach가 최상위에 있었으며, 가장 가까운 `describe('postAnalyze 함수는')` 블록 내부로 이동하여 해결

## [PR #78 | feat/74/AnalysisPanel-개선-아코디언-토글 | 2026-03-29]
- Violation: `patternSummaries`와 `skillResults` 신규 필드가 fixture에만 추가되고 배열 반환 검증 테스트 케이스가 누락됨
- Rule: CONVENTIONS.md — Tests: "Not updating tests when return type changes: Tests must be updated whenever types change"
- Context: `AnalysisResponse`에 `patternSummaries`와 `skillResults` 필드가 추가되었으나 `signals`, `skillSignals`와 달리 배열 여부를 검증하는 `it` 케이스가 없었음; `정상 입력으로 analyze를 호출하면` describe 블록에 두 케이스를 추가하여 해결

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

## [PR #76 | fix/72/타임프레임-변경-시-AI-분석-자동-업데이트 | 2026-03-29]
- Violation: `useRef(timeframeChangeCount)`로 초기화하여 Suspense remount 시 ref가 현재 count 값으로 초기화되어 타임프레임 변경 분석이 실행되지 않는 버그
- Rule: MISTAKES.md — Components: Managing timeframe as URL query parameter / useEffect Side Effect Isolation (올바른 초기값으로 ref를 초기화해야 함)
- Context: `useBars`가 `useSuspenseQuery`를 사용하기 때문에 캐시 miss 시 ChartContent가 remount되는데, 이때 `useRef(timeframeChangeCount)`로 초기화하면 ref.current가 현재 count 값과 동일해져서 useEffect에서 조기 반환이 발생하여 분석이 실행되지 않음. `useRef(0)`으로 초기화해야 remount 시에도 올바르게 동작함.

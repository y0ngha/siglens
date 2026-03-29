# Fix Log

## [PR #77 | docs/73/domain-타입-명세-확장 | 2026-03-29]
- Violation: `Skill` 인터페이스에 `pattern?: string` 필드 누락 — YAML frontmatter의 `pattern` 필드가 타입에 반영되지 않아 infrastructure 레이어가 파싱한 패턴 식별자를 domain에 전달할 방법이 없었음
- Rule: CONVENTIONS.md — TypeScript Rules: interface fields must be camelCase and all fields represented; domain types must faithfully reflect the data structure
- Context: `type='pattern'` skill의 `pattern` 식별자(예: `'double_top'`)는 YAML frontmatter에 존재하고 `PatternResult.patternName` 매핑의 원천이 되지만 `Skill` 인터페이스에 `pattern?: string` 필드가 없어 타입 정의가 불완전했음

## [PR #77 | docs/73/domain-타입-명세-확장 | 2026-03-29]
- Violation: `PatternResult`가 `PatternSummary`의 5개 필드(`patternName`, `skillName`, `detected`, `trend`, `summary`)를 중복 선언하여 `extends` 없이 별개 인터페이스로 관리됨
- Rule: FF.md — Cohesion 3-A: 함께 변경되어야 하는 코드는 함께 두어야 한다; `PatternSummary`에 필드가 추가될 때 `PatternResult`도 수동 동기화 필요
- Context: `PatternResult`는 `PatternSummary`의 모든 필드를 포함하면서 `renderConfig`만 추가하는 구조이므로 `interface PatternResult extends PatternSummary`로 중복을 제거해야 응집도가 유지됨

## [Issue #74 | feat/74/AnalysisPanel-개선-아코디언-토글 | 2026-03-29]
- Violation: `PatternAccordionItem`에서 `<button>` 안에 `<button>`을 중첩하여 HTML 명세 위반 및 접근성 문제 발생
- Rule: HTML 명세 — interactive content는 `<button>` 내부에 위치 불가; 브라우저가 DOM을 자동 수정하면서 예상치 못한 이벤트 동작 유발
- Context: 아코디언 헤더(handleToggleOpen)가 `<button>`이고 그 내부에 눈 아이콘 토글(handleToggleVisibility)도 `<button>`으로 구현되어 중첩 발생; 외부 버튼을 `<div role="button" tabIndex={0}>`으로 변경하여 해결

## [Issue #74 | feat/74/AnalysisPanel-개선-아코디언-토글 | 2026-03-29]
- Violation: `setState` updater 함수 내부에서 `onPatternVisibilityChange` 사이드 이펙트를 호출하여 React Strict Mode에서 updater가 두 번 실행될 경우 콜백이 두 번 호출됨
- Rule: FF.md Predictability 2-C — updater 함수는 순수 함수여야 하며 사이드 이펙트는 updater 밖에서 처리해야 함
- Context: `handleTogglePatternVisibility`의 `setVisiblePatterns` updater 내부에서 `onPatternVisibilityChange?.()`를 호출했으며, updater 바깥에서 `willBeVisible`을 계산하고 `setVisiblePatterns(next)`와 `onPatternVisibilityChange?.()`를 순차 호출하는 방식으로 수정

## [Issue #74 | feat/74/AnalysisPanel-개선-아코디언-토글 | 2026-03-29]
- Violation: `beforeEach`가 `describe` 블록 바깥 최상위 레벨에 위치하여 테스트 구조 규칙 위반
- Rule: CONVENTIONS.md — Test Rules: 모든 setup 코드는 해당 describe 블록 내부에 위치해야 일관성 유지
- Context: `analysisApi.test.ts`의 `mockFetch.mockReset()` beforeEach가 최상위에 있었으며, 가장 가까운 `describe('postAnalyze 함수는')` 블록 내부로 이동하여 해결

## [PR #76 | fix/72/타임프레임-변경-시-AI-분석-자동-업데이트 | 2026-03-29]
- Violation: `useRef(timeframeChangeCount)`로 초기화하여 Suspense remount 시 ref가 현재 count 값으로 초기화되어 타임프레임 변경 분석이 실행되지 않는 버그
- Rule: MISTAKES.md — Components: Managing timeframe as URL query parameter / useEffect Side Effect Isolation (올바른 초기값으로 ref를 초기화해야 함)
- Context: `useBars`가 `useSuspenseQuery`를 사용하기 때문에 캐시 miss 시 ChartContent가 remount되는데, 이때 `useRef(timeframeChangeCount)`로 초기화하면 ref.current가 현재 count 값과 동일해져서 useEffect에서 조기 반환이 발생하여 분석이 실행되지 않음. `useRef(0)`으로 초기화해야 remount 시에도 올바르게 동작함.

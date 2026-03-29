# Fix Log

## [PR #77 | docs/73/domain-타입-명세-확장 | 2026-03-29]
- Violation: `Skill` 인터페이스에 `pattern?: string` 필드 누락 — YAML frontmatter의 `pattern` 필드가 타입에 반영되지 않아 infrastructure 레이어가 파싱한 패턴 식별자를 domain에 전달할 방법이 없었음
- Rule: CONVENTIONS.md — TypeScript Rules: interface fields must be camelCase and all fields represented; domain types must faithfully reflect the data structure
- Context: `type='pattern'` skill의 `pattern` 식별자(예: `'double_top'`)는 YAML frontmatter에 존재하고 `PatternResult.patternName` 매핑의 원천이 되지만 `Skill` 인터페이스에 `pattern?: string` 필드가 없어 타입 정의가 불완전했음

## [PR #77 | docs/73/domain-타입-명세-확장 | 2026-03-29]
- Violation: `PatternResult`가 `PatternSummary`의 5개 필드(`patternName`, `skillName`, `detected`, `trend`, `summary`)를 중복 선언하여 `extends` 없이 별개 인터페이스로 관리됨
- Rule: FF.md — Cohesion 3-A: 함께 변경되어야 하는 코드는 함께 두어야 한다; `PatternSummary`에 필드가 추가될 때 `PatternResult`도 수동 동기화 필요
- Context: `PatternResult`는 `PatternSummary`의 모든 필드를 포함하면서 `renderConfig`만 추가하는 구조이므로 `interface PatternResult extends PatternSummary`로 중복을 제거해야 응집도가 유지됨

## [PR #76 | fix/72/타임프레임-변경-시-AI-분석-자동-업데이트 | 2026-03-29]
- Violation: `useRef(timeframeChangeCount)`로 초기화하여 Suspense remount 시 ref가 현재 count 값으로 초기화되어 타임프레임 변경 분석이 실행되지 않는 버그
- Rule: MISTAKES.md — Components: Managing timeframe as URL query parameter / useEffect Side Effect Isolation (올바른 초기값으로 ref를 초기화해야 함)
- Context: `useBars`가 `useSuspenseQuery`를 사용하기 때문에 캐시 miss 시 ChartContent가 remount되는데, 이때 `useRef(timeframeChangeCount)`로 초기화하면 ref.current가 현재 count 값과 동일해져서 useEffect에서 조기 반환이 발생하여 분석이 실행되지 않음. `useRef(0)`으로 초기화해야 remount 시에도 올바르게 동작함.

# Fix Log

## [예시 항목 | 브랜치명 | 날짜]
- Violation: 예시
- Rule: 예시
- Context: 예시

## [Issue #177 | feat/177/MA-EMA-토글버튼-크기통일-초기비활성 | 2026-04-05]
- Violation: `useMemo`로 `buttonRefMap`을 감쌌으나 deps가 빈 배열 `[]`이라 아무런 memoization 효과가 없음
- Rule: CONVENTIONS.md — useMemo는 실제로 재계산 비용이 있는 값에만 사용해야 함; 안정된 ref 참조를 memoize하는 것은 불필요한 코드
- Context: `IndicatorToolbar.tsx`에서 `maButtonRef`, `emaButtonRef`를 모아 `buttonRefMap`을 만들 때 불필요하게 `useMemo`를 사용함 — refs는 이미 안정된 참조이므로 plain const로 충분함

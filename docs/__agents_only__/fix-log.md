# Fix Log

## [예시 항목 | 브랜치명 | 날짜]
- Violation: 예시
- Rule: 예시
- Context: 예시

## [Issue #126 | feat/126/신규-지표-skills-AI-프롬프트-통합 | 2026-04-05]
- Violation: 사용하지 않는 'PatternSummary' import를 제거하지 않고 남겨둠
- Rule: CONVENTIONS.md — 사용하지 않는 import는 제거해야 함 (TypeScript 6196 규칙)
- Context: AnalysisPanel.tsx에서 PatternSummary 타입을 import했으나 컴포넌트 내부에서 실제로 사용하지 않아 dead import로 남아 있었음

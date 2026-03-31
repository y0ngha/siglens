# Fix Log

## [Issue #107 | fix/107/보조지표-드롭다운-잘림 | 2026-03-31]
- Violation: buttonRefMap declared as a plain object literal inside the component body on every render without memoization
- Rule: FF.md Cohesion 3-B — derived constants that never change should be extracted outside the component or wrapped in useMemo to make their static nature explicit
- Context: buttonRefMap in IndicatorToolbar.tsx maps IndicatorType keys to useRef values; wrapped with useMemo to avoid unnecessary re-creation on each render

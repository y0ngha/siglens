# Fix Log

## [PR #111 | feat/108/보조지표-레이블-표시 | 2026-03-31]
- Violation: ResizeObserver callback used forEach with multiple statements and re-accessed external array via index instead of using the callback parameter directly
- Rule: MISTAKES.md Coding Paradigm #1 (prefer for...of over forEach for multi-statement loop bodies) and MISTAKES.md Coding Paradigm #9 (do not discard callback parameter and re-access same element via external array index)
- Context: In usePaneLabels.ts, the ResizeObserver callback iterated newElements with forEach and used labels[index] to get paneIndex, creating a viewpoint shift; fixed by pre-zipping labels and newElements into labelPairs and iterating with for...of

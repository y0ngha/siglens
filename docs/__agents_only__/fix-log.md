# Fix Log

## [PR #105 | refactor/104/AI-프롬프트-문자열-영어로-변환 | 2026-03-31]
- Violation: Using `getMultiCandlePatternLabel(multiPattern)` instead of the identifier `multiPattern` directly in English prompt string
- Rule: Prompt language consistency — all English prompt strings should use identifiers directly rather than calling a label function that may return different language labels
- Context: In `src/domain/analysis/prompt.ts` line 96, the multi-candle pattern was displayed using `getMultiCandlePatternLabel()` which is inconsistent with the all-English prompt approach; replaced with direct use of `multiPattern` identifier and removed the now-unused import

## [PR #105 | refactor/104/AI-프롬프트-문자열-영어로-변환 | 2026-03-31]
- Violation: Test file structure exceeded 3 levels (4 levels: describe('prompt') > describe('buildAnalysisPrompt') > describe(context) > it(behavior))
- Rule: MISTAKES.md Test Rule 9 — test file must use exactly 3 levels: describe(subject) > describe(context) > it(behavior)
- Context: In `src/__tests__/domain/analysis/prompt.test.ts`, the `describe('buildAnalysisPrompt')` wrapper was an unnecessary intermediate layer; removed it so all context describe blocks are directly under `describe('prompt')`

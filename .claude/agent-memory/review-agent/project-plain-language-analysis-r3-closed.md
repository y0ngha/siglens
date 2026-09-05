---
name: plain-language-analysis-r3-closed
description: feat/plain-language-analysis R3 (final) — both R2 findings verified fixed, approved, closes loop
metadata:
  type: project
---

R2 found (1) `readPlain()` had zero test coverage and deleting it in any of the
5 non-overall hooks failed zero tests, (2) `serverKeyFor()` hand-rolled
`model.startsWith(...)` provider matching duplicating a mapping that exists
twice elsewhere.

R3 fix verified:
- `plainEnvelope.test.ts` (6 cases) + new `plainWiring.test.tsx` (10 cases,
  drives all 5 hooks — news/options/financials/congress/fundamental — through
  a mocked `runAnalysisStream`). Live mutation re-test: `plain: readPlain(result)`
  → `plain: null` in `useNewsAnalysis.ts` fails exactly 1/10 test; reverted
  clean (confirmed via `git status --short`, file not listed as modified).
- `serverKeyFor` now calls core's `getProviderForModel(model)` (returns
  `'anthropic' | 'google' | 'openai' | 'deepseek'`, throws on truly unknown
  modelId) and switches with a `never`-exhaustiveness default. `model` is
  always pre-validated via `isActiveModelId` (own-key check against
  `MODEL_SPECS`) before reaching `serverKeyFor`, so the throw path is
  unreachable from `tryReadPlainModelConfig` in practice. Existing
  `plainModel.test.ts` (pre-dates this round) already exercises the
  deepseek→gemini provider switch through the new code path.

All gates green: tsc 0, oxlint 0 (yarn lint truly empty output, exit 0),
oxfmt --check clean, i18n:verify 2351×3 pass, i18n:lint 0 unextracted, vitest
1173 files/11448 tests all green, 0 "unhandled" hits in log (vs master's 6).

Approved, closes the review loop for this epic. See also [[plain-language-analysis-r1]].

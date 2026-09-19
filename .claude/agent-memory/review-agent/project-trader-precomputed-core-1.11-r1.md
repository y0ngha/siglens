---
name: trader-precomputed-core-1.11-r1
description: siglens-trader fix/precomputed-core-1.11 R1 — core 1.10→1.11 bump, currentFiscalYearRow, lazy currentPrice getter; single-row fixture made "latest past row" fallback unfalsifiable
metadata:
  type: project
---

siglens-trader worktree `/Users/y0ngha/Project/siglens-trader-wt-computed`, branch fix/precomputed-core-1.11, R1 (2026-09-19). Uncommitted diff; tsc 0, eslint 0, 50/50 tests green.

- Required: `currentFiscalYearRow` fallback test used `rows.slice(2)` = ONE past row, so `dated[last]` → `dated[0]` / `arr[0]` mutations survive. The sibling siglens test (siglens-wt-computed) uses `slice(5)` = two past rows and kills it — trader copy lost that.
- Recommended: `quotePrice` hand-rolls finite/>0 guard; `lib/validation.ts` `isFinitePositive` already used in `lib/analysis/confluence.ts`.
- Verified non-issues: core resolves the getter only after cache miss and swallows rejection (`resolveCurrentPriceOption`); trader never parses core `riskReward` text or `keyPrices` (computes its own `riskRewardRatio`); `toSorted` absent because tsconfig target ES2022 with no `lib`.

**Why:** records the falsifiability miss pattern (port of a sibling helper drops the test's discriminating row count).

**How to apply:** when a helper is ported between repos, diff the tests too — the port often shrinks the fixture below what the assertion needs. Trader technique: diff `siglens-trader/node_modules/@y0ngha/siglens-core/dist` (main checkout = old pin) vs the worktree's to enumerate core API changes. Prettier diffs in trader are not findings — `.husky/pre-commit` runs lint-staged `prettier --write`.

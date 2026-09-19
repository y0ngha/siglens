---
name: trader-precomputed-core-1.11-r2
description: siglens-trader fix/precomputed-core-1.11 R2 — approved; R1 fallback-test fix killed 4 mutations in a scratch copy; quotePrice now uses isFinitePositive
metadata:
  type: project
---

R2 (2026-09-19), worktree `/Users/y0ngha/Project/siglens-trader-wt-computed`. Approved. tsc 0, eslint 0, 50/50.

- `currentFiscalYearRow` fallback test now has two past rows (newest-first + reversed). Mutations `dated[0]`, `arr[0]`, `arr[arr.length-1]`, and dropping `.sort` all fail the suite.
- `quotePrice` uses `isFinitePositive(quote?.price) ? quote.price : null`. TS narrows `quote` through the optional chain, so tsc passes without a `!`.
- `lib/data/fmp-fundamental.ts` had a later mtime than the listed modified_files but was not in the list. I re-read it: the JSDoc matches the code, so it was not a finding.

**Why:** closes [[trader-precomputed-core-1.11-r1]].

**How to apply:** trader scratch mutation recipe: copy `lib/`, `src/__tests__/setup.ts`, `vitest.config.ts`, `tsconfig.json`, and `package.json` into the scratchpad, symlink `node_modules`, then run `./node_modules/.bin/vitest run <file>`. The worktree stays untouched.
